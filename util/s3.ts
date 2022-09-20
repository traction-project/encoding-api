import aws from "aws-sdk";

/**
 * Uploads a file to S3 and assigns it the given name. The name is an S3 key
 * path and can include a prefix. The third parameter is the name of the target
 * bucket. The function returns a void promise which resolves once the upload
 * is complete or rejects with an error otherwise.
 *
 * @param keyname Name that the file should be stored under in the S3 bucket
 * @param file Contents of the file to be uploaded
 * @param bucket Name of the bucket to store the file in
 * @returns A promise which resolves upon completion
 */
export function uploadToS3(keyname: string, file: aws.S3.Body, bucket: string): Promise<void> {
  const s3 = new aws.S3();

  return new Promise((resolve, reject) => {
    // Upload file to given bucket under given key
    s3.upload({
      Bucket: bucket, Key: keyname, Body: file
    }, {
      // Upload in chunks of 5MB, 10 chunks in parallel
      partSize: 5 * 1024 * 1024, queueSize: 10
    }, (err) => {
      // Reject promise if there was an error, otherwise resolve
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Deletes the object with the given key from an S3 bucket. This function
 * returns a promise which resolves upon successful deletion of the object or
 * rejects with an error otherwise.
 *
 * @param keyname Name of object to be deleted
 * @param bucket Name of the bucket the object is located in
 * @returns A promise which resolves upon completion
 */
export function deleteFromS3(keyname: string, bucket: string): Promise<void> {
  const s3 = new aws.S3();

  return new Promise((resolve, reject) => {
    s3.deleteObject({
      Bucket: bucket,
      Key: keyname
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
