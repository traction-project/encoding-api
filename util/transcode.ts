import aws from "aws-sdk";
import { existsSync, readFileSync } from "fs";

// Path to file containing custom presets
const PRESET_FILE_PATH = "./presets.json";

// Check if preset file exists and read it if it does
const customPresets = (existsSync(PRESET_FILE_PATH)) ? (
  JSON.parse(readFileSync(PRESET_FILE_PATH).toString())
) : (
  {}
);

/**
 * List of available video resolutions and their ETS preset names
 */
export const resolutions: { [key: string]: string } = {
  "720p": "1351620000001-500020",
  "480p": "1351620000001-500030",
  "360p": "1351620000001-500040",
  "240p": "1351620000001-500050",
  ...customPresets
};

/**
 * Separates an Amazon S3 key into a tuple with separate elements for prefix
 * path, file basename and file extension.
 *
 * @param input Name of the input with prefix path and extension
 * @returns A tuple with an element for prefix path, file basename and extension
 */
function processInputPath(input: string): [prefix: string, basename: string, extension: string] {
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
 * By default, the given input file is encoded into three output video streams
 * with the bitrates 4800k, 2400k and 1200k and one audio track (unless
 * `hasAudio` is set to false). Thumbnails will be generated as PNG files from
 * the 4800k video stream, with one thumbnail saved every 5 minutes.
 *
 * The function also accepts an array of video resolutions that should be
 * generated for the output. By default, possible values for items in the array
 * are `720p`, `480p`, `360p` and `240p`. Custom presets can be added by
 * modifying the file `presets.json` at the application root and available
 * resolutions can be retrieved by examining the value of the const
 * `customPresets` All other values are ignored. The parameter defaults to
 * `["720p", "480p", "360p"]`.
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
      const preset = resolutions[resolution];

      // Generate entry with right folder and preset name
      return [
        ...outputs,
        {
          Key: `dash-${resolution}/${inputBasename}`,
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
  // with separate directories for each resolution. Audio tracks and thumbnails
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
 * Returns the status of the transcoding job with the given ID. Also returns
 * the path to the manifest if available.
 *
 * @param jobId Transcoding job ID which should be checked
 * @returns The job status, may be one of `Submitted`, `Progressing`, `Complete`, `Canceled`, or `Error` and the path to the manifet if `Complete`
 */
export function getJobStatus(jobId: string): Promise<[status: string, manifest?: string]> {
  return new Promise((resolve, reject) => {
    const transcoder = new aws.ElasticTranscoder();

    // Read job status from transcoder API
    transcoder.readJob({ Id: jobId }, (err, data) => {
      if (err) {
        // Reject promise if there was an error
        reject(err);
      } else {
        if (data.Job?.Status) {
          // Resolve with manifest path if job is complete
          if (data.Job.Status == "Complete" && data.Job.Playlists) {
            resolve([
              data.Job.Status,
              `${data.Job.OutputKeyPrefix}${data.Job.Playlists[0].Name}.mpd`
            ]);
          } else {
            // Resolve with current job status if job is not complete
            resolve([ data.Job.Status ]);
          }
        } else {
          reject(undefined);
        }
      }
    });
  });
}
