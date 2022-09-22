import { Router } from "express";
import passport from "passport";
import busboy from "busboy";
import { v4 as uuid4 } from "uuid";

import { User } from "../../models/user";
import { getExtension, getFromEnvironment } from "../../util";
import { tokenRequired } from "../../util/middleware";
import { uploadToS3, deleteFromS3 } from "../../util/s3";
import { encodeDash, getJobStatus } from "../../util/transcode";

const [ BUCKET_NAME, ETS_PIPELINE ] = getFromEnvironment("BUCKET_NAME", "ETS_PIPELINE");
const UPLOAD_PREFIX = "upload/";

const router = Router();

/**
 * Returns with HTTP code 200. This serves as an API health check.
 */
router.get("/", (_, res) => {
  res.send({
    status: "OK"
  });
});

/**
 * Returns a JSON Web Token which can be used to authenticate subsequent
 * requests, provided a valid username/password combination is supplied. The
 * credentials are expected under the keys `username` and `password` in a JSON
 * data structure in the body of the request.
 *
 * If the request body does not contain the expected parameters, a response
 * with HTTP code 400 is returned. If either username of password are incorrect,
 * HTTP code 401 is returned.
 *
 * Upon successful authentication, a JSON data structure is returned containing
 * the user's internal ID in the key `_id`, the associated username in the key
 * `username` and the signed token itself under the key `token`. The value of
 * this field has to be supplied in the `Authorization` header as a bearer
 * token of any request to other authenticated API calls.
 */
router.post("/login", (req, res, next) => {
  const { username, password  } = req.body;

  // Return HTTP code 400 if either username of password are missing
  if (!username || !password) {
    return res.status(400).send({
      status: "ERR",
      message: "Insufficient parameters"
    });
  }

  // Attempt to authenticate the request using the `local` authentication strategy
  return passport.authenticate("local", { session: false }, (err: Error | null, user: User | undefined, msg: { message: string }) => {
    // Pass erorr to next handler if any error occurred
    if (err) {
      return next(err);
    }

    // If user is defined, return authentication token data structure
    if (user) {
      return res.send(user.getAuth());
    }

    // Return HTTP code 401 if authentication failed
    res.status(401).send({
      status: "ERR",
      ...msg
    });
  })(req, res, next);
});

/**
 * Returns with HTTP code 200 if a valid token is supplied. This serves to test
 * token validity and login status.
 */
router.get("/loginstatus", tokenRequired, (_, res) => {
  res.send({
    status: "OK"
  });
});

/**
 * Uploads a given file to the specified S3 bucket. The file is expected under
 * the key `file` of a `multipart/form-data` request. Upon successful upload to
 * S3, the autogenerated name of the uploaded file including its path is
 * returned in a JSON data structure under the key `name`.
 *
 * If the upload to S3 fails, the request returns with HTTP code 500.
 */
router.post("/upload/raw", tokenRequired, (req, res) => {
  // Initialise busboy session
  const bb = busboy({ headers: req.headers });

  // Install handler for HTTP multipart requests
  bb.on("file", async (_, file, fileinfo) => {
    try {
      // Generate new name for file
      const newName = UPLOAD_PREFIX + uuid4() + getExtension(fileinfo.filename);
      // Upload file from request body to the given S3 bucket using the new name
      await uploadToS3(newName, file, BUCKET_NAME);

      // Return new name in response
      res.send({
        status: "OK",
        name: newName
      });
    } catch (e) {
      console.error(e);

      // Return HTTP code 500 if an exception occurs during upload
      res.status(500).send({
        status: "ERR",
        message: "Could not upload to S3"
      });
    }
  });

  // Pipe request through busboy session
  req.pipe(bb);
});

/**
 * Deletes a previously uploaded file from the S3 bucket. The filename needs to
 * be supplied including its full path in the JSON body of the request under
 * the name `key`. Otherwise a response with HTTP code 400 is returned.
 *
 * If an exception occurs during deletion the request returns a response with
 * HTTP code 500.
 */
router.delete("/upload/raw", tokenRequired, async (req, res) => {
  const { key } = req.body;

  // Return HTTP code 400 if no key was specified in the request
  if (!key) {
    return res.status(400).send({
      status: "ERR",
      message: "No key specified"
    });
  }

  try {
    // Try to delete the key from the S3 bucket
    await deleteFromS3(key, BUCKET_NAME);

    res.send({
      status: "OK"
    });
  } catch (e) {
    console.error(e);

    // Return HTTP code 500 if an exception occurs during deletion
    res.status(500).send({
      status: "ERR",
      message: "Could not delete from S3"
    });
  }
});

/**
 * Starts a new DASH transcoding job for an existing raw input.
 * This route needs to be called with the `Content-Type` header of the request
 * being set to `application/json` and a JSON object containing the key `input`
 * needs to be provided in the request body. The value associated to the `input`
 * key should specify the path to an existing raw upload. If the request body
 * does not define a key `input`, an error 400 is returned.
 *
 * If the given input is a video file which does not have an audio stream, an
 * additional parameter named `hasAudio` set to `false` needs to be added to
 * the request body, otherwise the encoding will fail. If this `hasAudio`
 * parameter is missing, it is assumed to be `true`.
 *
 * The function also optionally accepts an array of video resolutions that
 * should be generated for the output in the request body under the key
 * `resolutions`. Possible values for items in the array are `720p`, `480p`,
 * `360p`, `240p` and `180p`. All other values are ignored. Defaults to
 * `["720p", "480p", "360p"]`.
 *
 * The function then attempts to start a new transcoding job for the given
 * input and if successful returns a JSON object containing the key `jobId`,
 * with which the status of the transcoding job can be checked. If the
 * transcoding job could not be started an error 500 is returned.
 */
router.post("/upload/encode", tokenRequired, async (req, res) => {
  const { input, hasAudio, resolutions } = req.body;

  // Return HTTP code 400 if no input path was specified in the request
  if (!input) {
    return res.status(400).send({
      status: "ERR",
      message: "No input path specified"
    });
  }

  try {
    // Start transcoding job with the given options
    const jobId = await encodeDash(ETS_PIPELINE, input, hasAudio, resolutions);

    // Return job ID to client
    res.send({
      status: "OK",
      jobId
    });
  } catch (e) {
    // Return HTTP code 500 if an exception occurs during job creation
    res.status(500).send({
      status: "ERR",
      message: e.message
    });
  }
});

/**
 * Tries to retrieve to transcoding job status of the job with the given ID.
 * Returns an object with the key `jobStatus`, whose value will be one of
 * `Submitted`, `Progressing`, `Complete`, `Canceled`, or `Error`. If the value
 * of `jobStatus` is equal to `Complete`, the object also contains the key
 * `manifest`, which contains a link to the generated MPD playlist for the job.
 */
router.get("/upload/encode/status/:jobId", tokenRequired, async (req, res) => {
  const { jobId } = req.params;

  // Return HTTP code 400 if no job ID was specified in the request
  if (!jobId) {
    return res.status(400).send({
      status: "ERR",
      message: "No input path specified"
    });
  }

  try {
    // Get job status from the transcoder API
    const [ status, manifest ] = await getJobStatus(jobId);
    const response = {
      status: "OK",
      jobStatus: status
    };

    // Return manifest path if transcoding job is complete
    if (status == "Complete") {
      res.send({
        ...response,
        manifest
      });
    } else {
      // Return job status
      res.send(response);
    }

  } catch (e) {
    // Return HTTP code 500 if job status could not be retrieved
    res.status(500).send({
      status: "ERR",
      message: e.message
    });
  }
});

export default router;
