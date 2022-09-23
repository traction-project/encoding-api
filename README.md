# TRACTION Encoding API

A self-contained Express application for uploading media files to AWS S3 and
starting Elastic Transcoder encoding jobs. This is a self-contained version of
the API found in the Co-Creation Space and can be deployed with a minimal
amount of dependencies.

<img src="https://www.traction-project.eu/wp-content/uploads/sites/3/2020/02/Logo-cabecera-Traction.png" align="left"/><em>This tool was originally developed as part of the <a href="https://www.traction-project.eu/">TRACTION</a> project, funded by the European Commission’s <a hef="http://ec.europa.eu/programmes/horizon2020/">Horizon 2020</a> research and innovation programme under grant agreement No. 870610.</em>

## Setup

In order to run the application, a JSON file containing AWS credentials called
`aws.json` needs to be placed in the application root. Further, the file
`.env-sample` needs to be renamed to `.env` and the following values need to be
filled in:

- `SESSION_SECRET` a string of random characters that is used to sign the JSON
  Web Tokens
- `BUCKET_NAME` the name of the S3 bucket that the files should be uploaded to
- `ETS_PIPELINE` the name of the Elastic Transcoder pipeline used to transcode
  uploaded media files

After this, the Docker container can be built and started as such:

    docker compose build
    docker compose up -d

This will build the container and launch it. After initialisation, the
application is available on port 3001.

## Adding User Accounts

The application uses SQLite to manage user accounts. Initially, the database is
empty, but new user accounts can be added using the script `register.js`.

In order to run this script, ensure the container is running and invoke the
following command from the command line:

    docker compose exec web yarn register

The script will ask for a new username and a password. The selected values are
inserted into the database and can then be used to log into the API and obtain
a JSON Web Token for all further calls. The obtained token is valid for 60
days.

NB: The script will fail if the chosen username already exists, i.e. usernames
must be unique.

## API Documentation

The following sections document each of the API endpoints that the application
supplies in order to facilitate media upload and encoding. This documentation
can also be used as a specification to implement alternative APIs, e.g. ones
that do not rely on external cloud services.

NB: The `Content-Type` header of requests which send data should be set to
`application/json` to ensure that the request is interpreted quickly. This
does not apply to `/api/upload/raw`.

Please refer to the script `example.py`, which illustrates a sample interaction
with the API, including login, file upload, starting of a transcoding job,
checking of job status and finally deleting the originally uploaded file. In
order to run the script, the package `requests` has to be installed.

### Obtaining a Token

In order to interact with the API, the caller is required to supply a JSON Web
Token along with each request. This token can be obtained by calling the route
`/api/login` with a valid user account. Refer to the previous section on how to
add new user accounts. The endpoint expects the parameters `username` and
`password` inside a JSON dictionary in the body of the request:

    POST /api/login
    Content-Type: application/json

    { "username": "test", "password": "test" }

Upon successful login, the API returns a JSON dictionary containing the keys
`_id`, `username` and `token`. The value of `token` should then be used to
authenticate requests to any other endpoint.

### Uploading a File

The endpoint `/api/upload/raw` serves to upload files to the associated S3
bucket. The file should be submitted in the body of a `multipart/form-data`
request under the key `file`. Also take note of the presence of the previously
obtained token in the `Authorization` header.

    POST /api/upload/raw
    Authorization: Bearer [TOKEN]
    Content-Type: multipart/form-data; charset=utf-8; boundary=__BOUNDARY__

    --__BOUNDARY__
    Content-Disposition: form-data; name="file"; filename="example.mp4"

    [FILE_CONTENTS]
    --__BOUNDARY__--

A request like this can be executed in `curl` as such:

    curl -v -XPOST --header "Authorization: Bearer [TOKEN]" -F file=@[PATH_TO_FILE] http://example.com/api/upload/raw

Upon success, the call with return a JSON dictionary containing  the path to
the newly uploaded file under the key `name`.

### Deleting Uploaded Files

Previously uploaded files can be deleted by calling `/api/upload/raw` with the
verb HTTP `DELETE`, supplying the path to the file to be deleted under the key
`key` in the JSON request body.

    DELETE /api/upload/raw
    Authorization: Bearer [TOKEN]
    Content-Type: application/json

    { "key": "[PATH_TO_FILE_ON_S3]" }

### Starting a Transcoding Job

In order to start a DASH transcoding job for an uploaded video or audio file,
a request to the endpoint `/api/upload/encode` has to be made. The endpoint
expects the key `input` containing the path to the file to be encoded in the
JSON body of the request.

Optionally, a list of desired output resolutions can be submitted as an array.
Accepted values for items in the array are `1080p`, `720p`, `480p`, `360p`,
`240p` and `180p`. If not supplied, the file is encoded to `720p`, `480p` and
`360p`.

Also note, if a video file which does not contain an audio track is to be
encoded, the option `hasAudio` set to `false` has to be passed in the request
body. Otherwise the encoding will fail. If omitted, `hasAudio` defaults to
`true`.

    POST /api/upload/encode
    Authorization: Bearer [TOKEN]
    Content-Type: application/json

    { "input": "[PATH_TO_FILE_ON_S3]", "resolutions": ["1080p", "360p"] }

Upon success, the response will contain the job ID of the newly started
transcoding job under the key `jobId` in the JSON response body.

### Checking Transcoding Job Status

To check the status of a started transcoding job, the API supplies the endpoint
`/api/upload/encode/status/:jobId`, where `:jobID` is the job ID of a
transcoding job.

    GET /api/upload/encode/status/[JOB_ID]
    Authorization: Bearer [TOKEN]

The request will return the current status of the transcoding job with the
specified ID. The key `jobStatus` will contain one of `Submitted`,
`Progressing`, `Complete`, `Canceled` or `Error`. If the value of `jobStatus`
is equal to `Complete`, the response will also contain the key `manifest`,
which contains the path to the DASH manifest that can be used to play back the
encoded media file.
