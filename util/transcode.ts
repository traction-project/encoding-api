import aws from "aws-sdk";

/**
 * List of available video resolutions and their ETS preset names
 */
const resolutions: { [key: string]: [presetName: string, bitrate: string] } = {
  "1080p": ["1653913357100-ikb9ew", "6m"],
  "720p": ["1351620000001-500020", "4m"],
  "480p": ["1351620000001-500030", "2m"],
  "360p": ["1351620000001-500040", "1m"],
  "240p": ["1351620000001-500050", "600k"],
  "180p": ["1619779551954-u1rt32", "100k"]
};

/**
 * Separates an Amazon S3 key into a tuple with separate elements for prefix
 * path, file basename and file extension.
 *
 * @param input Name of the input with prefix path and extension
 * @returns A tuple with an element for prefix path, file basename and extension
 */
export function processInputPath(input: string): [ prefix: string, basename: string, extension: string ] {
  const pathComponents = input.split("/");

  // Get filename without path prefix
  const inputFilename = pathComponents[pathComponents.length - 1];

  // Reassemble path prefix
  let prefixPath = pathComponents.slice(0, pathComponents.length - 1).join("/");

  // Append slash at end of prefix if it is non-empty
  if (prefixPath.length > 0) {
    prefixPath += "/";
  }

  const filenameComponents = inputFilename.split(".");

  if (filenameComponents[0].length == 0) {
    throw new Error("Input basename is empty");
  }

  if (filenameComponents.length == 1) {
    return [prefixPath, filenameComponents[0], ""];
  } else {
    // Get filename without extension
    const inputBasename = filenameComponents.slice(0, filenameComponents.length - 1).join(".");
    // Get extension
    const extension = filenameComponents[filenameComponents.length - 1];

    return [prefixPath, inputBasename, extension];
  }
}

/**
 * Starts a new DASH video transcoding job in the given transcoding pipeline
 * using the given path as input. If the given input has no audio track, the
 * third parameter should be set to false, otherwise the transcoding job will
 * fail. Returns a promise which resolves to the job ID of the created
 * transcoding job or rejects with an error otherwise.
 *
 * The given input file is encoded into three output video streams with the
 * bitrates 4800k, 2400k and 1200k and one audio track (unless `hasAudio` is
 * set to false). Thumbnails will be generated as PNG files from the 4800k
 * video stream, with one thumbnail saved every 5 minutes.
 *
 * The function also accepts an array of video resolutions that should be
 * generated for the output. Possible values for items in the array are `1080p`,
 * `720p`, `480p`, `360p`, `240p` and `180p`. All other values are ignored.
 * Defaults to `["720p", "480p", "360p"]`.
 *
 * @param pipeline ID of the transcoding pipeline to use
 * @param input Path to input file
 * @param hasAudio Whether the file has an audio track, defaults to true
 * @param outputResolutions An array containing quality settings of video resolutions to be generated
 * @returns A promise which resolves to the job ID if successful, rejects with an error otherwise
 */
export function encodeDash(pipeline: string, input: string, hasAudio = true, outputResolutions = ["720p", "480p", "360p"]): Promise<string | undefined> {
  // Process input path
  const [ prefixPath, inputBasename ] = processInputPath(input);

  const dashOutputs = outputResolutions.reduce((outputs, resolution) => {
    // Check if value is a valid resolution
    if (resolutions[resolution]) {
      const [ preset, bitrate ] = resolutions[resolution];

      // Generate entry with right folder and preset name
      return [
        ...outputs,
        {
          Key: `dash-${bitrate}/${inputBasename}`,
          PresetId: preset,
          SegmentDuration: "3"
        }
      ];
    }

    return outputs;
  }, []).map((output, i) => {
    // Add key ThumbnailPattern to first element in array
    if (i == 0) {
      return { ...output, ThumbnailPattern: `thumbnails/${inputBasename}_{count}`};
    }

    return output;
  });

  // Transcoder configuration, outputs are placed under the path transcoded/,
  // with separate directories for each bitrate. Audio tracks and thumbnails
  // are also placed in separate directories. The manifest is placed directly
  // into the transcoded/ folder
  const params = {
    PipelineId: pipeline,
    Input: {
      Key: input,
    },
    OutputKeyPrefix: `${prefixPath}transcoded/`,
    Outputs: [
      ...dashOutputs,
      {
        Key: `dash-audio/${inputBasename}`,
        PresetId: "1351620000001-500060",
        SegmentDuration: "3"
      }
    ],
    Playlists: [
      {
        Format: "MPEG-DASH",
        Name: `${inputBasename}`,
        OutputKeys: [
          ...dashOutputs.map((o) => o.Key),
          `dash-audio/${inputBasename}`,
        ],
      }
    ]
  };

  // Remove config for audio track from transcoding config if hasAudio is false
  if (!hasAudio) {
    params.Outputs = params.Outputs.slice(0, -1);
    params.Playlists[0].OutputKeys = params.Playlists[0].OutputKeys.slice(0, -1);
  }

  // Create and submit transcoding job
  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    transcoder.createJob(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Job?.Id);
      }
    });
  });
}

/**
 * Starts a new HLS video transcoding job in the given transcoding pipeline
 * using the given path as input. If the given input has no audio track, the
 * third parameter should be set to false, otherwise the transcoding job will
 * fail. Returns a promise which resolves to the job ID of the created
 * transcoding job or rejects with an error otherwise.
 *
 * The given input file is encoded into three output video streams with the
 * bitrates 2M, 1M and 600k and one audio track (unless `hasAudio` is set to
 * false). Thumbnails will be generated as PNG files from the 2M video stream,
 * with one thumbnail saved every 5 minutes.
 *
 * @param pipeline ID of the transcoding pipeline to use
 * @param input Path to input file
 * @param hasAudio Whether the file has an audio track, defaults to true
 * @returns A promise which resolves to the job ID if successful, rejects with an error otherwise
 */
export function encodeHLS(pipeline: string, input: string, hasAudio = true): Promise<string | undefined> {
  // Process input path
  const [ prefixPath, inputBasename ] = processInputPath(input);

  // Transcoder configuration, outputs are placed under the path transcoded/,
  // with separate directories for each bitrate. Audio tracks and thumbnails
  // are also placed in separate directories. The manifest is placed directly
  // into the transcoded/ folder
  const params = {
    PipelineId: pipeline,
    Input: {
      Key: input,
    },
    OutputKeyPrefix: `${prefixPath}transcoded/`,
    Outputs: [
      {
        Key: `hls-2m/${inputBasename}`,
        PresetId: "1351620000001-200015",
        SegmentDuration: "3",
        ThumbnailPattern: `thumbnails/${inputBasename}_hls_{count}`
      }, {
        Key: `hls-1m/${inputBasename}`,
        PresetId: "1351620000001-200035",
        SegmentDuration: "3"
      }, {
        Key: `hls-600k/${inputBasename}`,
        PresetId: "1351620000001-200045",
        SegmentDuration: "3"
      }, {
        Key: `hls-audio/${inputBasename}`,
        PresetId: "1351620000001-200060",
        SegmentDuration: "3"
      }
    ],
    Playlists: [
      {
        Format: "HLSv4",
        Name: `${inputBasename}`,
        OutputKeys: [
          `hls-2m/${inputBasename}`,
          `hls-1m/${inputBasename}`,
          `hls-600k/${inputBasename}`,
          `hls-audio/${inputBasename}`,
        ],
      }
    ]
  };

  // Remove config for audio track from transcoding config if hasAudio is false
  if (!hasAudio) {
    params.Outputs = params.Outputs.slice(0, -1);
    params.Playlists[0].OutputKeys = params.Playlists[0].OutputKeys.slice(0, -1);
  }

  // Create and submit transcoding job
  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    transcoder.createJob(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Job?.Id);
      }
    });
  });
}

/**
 * Starts a new DASH audio transcoding job in the given transcoding pipeline
 * using the given path as input. Returns a promise which resolves to the job
 * ID of the created transcoding job or rejects with an error otherwise.
 *
 * The given input file is encoded into one output audio stream. If an audio
 * file is submitted as input, the video stream is discarded and only the audio
 * track is saved.
 *
 * @param pipeline ID of the transcoding pipeline to use
 * @param input Path to input file
 * @returns A promise which resolves to the job ID if successful, rejects with an error otherwise
 */
export function encodeAudio(pipeline: string, input: string): Promise<string> {
  // Process input path
  const [ prefixPath, inputBasename ] = processInputPath(input);

  // Transcoder configuration, outputs are placed under the path transcoded/,
  // whereas the manifest is placed directly into the transcoded/ folder
  const params = {
    PipelineId: pipeline,
    Input: {
      Key: input,
    },
    OutputKeyPrefix: `${prefixPath}transcoded/`,
    Outputs: [
      {
        Key: `dash-audio/${inputBasename}`,
        PresetId: "1351620000001-500060",
        SegmentDuration: "3"
      }
    ],
    Playlists: [
      {
        Format: "MPEG-DASH",
        Name: `${inputBasename}`,
        OutputKeys: [
          `dash-audio/${inputBasename}`
        ],
      }
    ]
  };

  // Create and submit transcoding job
  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    transcoder.createJob(params, (err, data) => {
      if (err) {
        reject(err);
      } else if (!data.Job || !data.Job.Id) {
        reject(new Error("Job ID undefined"));
      } else {
        resolve(data.Job.Id);
      }
    });
  });
}

/**
 * Starts a new HLS audio transcoding job in the given transcoding pipeline
 * using the given path as input. Returns a promise which resolves to the job
 * ID of the created transcoding job or rejects with an error otherwise.
 *
 * The given input file is encoded into one output audio stream. If an audio
 * file is submitted as input, the video stream is discarded and only the audio
 * track is saved.
 *
 * @param pipeline ID of the transcoding pipeline to use
 * @param input Path to input file
 * @returns A promise which resolves to the job ID if successful, rejects with an error otherwise
 */
export function encodeHLSAudio(pipeline: string, input: string): Promise<string> {
  // Process input path
  const [ prefixPath, inputBasename ] = processInputPath(input);

  // Transcoder configuration, outputs are placed under the path transcoded/,
  // whereas the manifest is placed directly into the transcoded/ folder
  const params = {
    PipelineId: pipeline,
    Input: {
      Key: input,
    },
    OutputKeyPrefix: `${prefixPath}transcoded/`,
    Outputs: [
      {
        Key: `hls-audio/${inputBasename}`,
        PresetId: "1351620000001-200060",
        SegmentDuration: "3"
      }
    ],
    Playlists: [
      {
        Format: "HLSv4",
        Name: `${inputBasename}`,
        OutputKeys: [
          `hls-audio/${inputBasename}`
        ],
      }
    ]
  };

  // Create and submit transcoding job
  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    transcoder.createJob(params, (err, data) => {
      if (err) {
        reject(err);
      } else if (!data.Job || !data.Job.Id) {
        reject(new Error("Job ID undefined"));
      } else {
        resolve(data.Job.Id);
      }
    });
  });
}

/**
 * Returns the status of the transcoding job with the given ID. Also returns
 * the path to the manifest if available.
 *
 * @param jobId Transcoding job ID which should be checked
 * @returns The job status, may be one of `Submitted`, `Progressing`, `Complete`, `Canceled`, or `Error` and the path to the manifet if `Complete`
 */
export function getJobStatus(jobId: string): Promise<[status: string, manifest?: string]> {
  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    transcoder.readJob({ Id: jobId }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        if (data.Job?.Status) {
          if (data.Job.Status == "Complete" && data.Job.Playlists) {
            resolve([
              data.Job.Status,
              `${data.Job.OutputKeyPrefix}${data.Job.Playlists[0].Name}.mpd`
            ]);
          } else {
            resolve([ data.Job.Status ]);
          }
        } else {
          reject(undefined);
        }
      }
    });
  });
}
