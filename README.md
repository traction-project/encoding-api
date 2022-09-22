# Encoding API

A self-contained Express application for uploading media files to AWS S3 and
starting Elastic Transcoder encoding jobs. This is a self-contained version of
the API found in the Co-Creation Space and can be deployed with a minimal
amount of dependencies

## Setup

In order to run the application, a JSON file containing AWS credentials called
`aws.json` needs to be place in the application root. Further, the file
`.env-sample` needs to be renamed to `.env` and the following values need to be
filled in:

- `SESSION_SECRET` a string of random characters that is used to sign the JSON
  Web Tokens.
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
a JSON Web Token for all futher calls. The obtained token is valid for 60 days.

NB: The scripts will fail if the chosen username already exists, i.e. usernames
must be unique.
