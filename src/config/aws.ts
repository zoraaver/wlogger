import * as AWS from "aws-sdk";
import path from "path";

AWS.config.loadFromPath(path.resolve(__dirname, "..", "..", "keys.json"));
export const S3: AWS.S3 = new AWS.S3();

// const testFilePath: string = path.resolve(__dirname, "test.txt");
// const fileStream: ReadStream = fs.createReadStream(testFilePath);

// interface BucketParams {
//   Bucket: string;
//   Key: string;
//   Body?: ReadStream;
// }

// const bucketParams: BucketParams = { Bucket: "wlogger", Key: "" };
// bucketParams.Body = fileStream;
// bucketParams.Key = path.basename(testFilePath);

// upload a file
// s3.upload(bucketParams, function (err: Error, data: any) {
//   if (err) {
//     console.log("Error", err);
//   }
//   if (data) {
//     console.log("Upload Success", data.Location);
//   }
// });

// list all s3 buckets
// s3.listBuckets(function (err, data) {
//   if (err) {
//     console.log("Error", err);
//   } else {
//     console.log("Success", data.Buckets);
//   }
// });
