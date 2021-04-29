import * as AWS from "aws-sdk";
import path from "path";
import multer from "multer";
import multerS3 from "multer-s3";
import { WLOGGER_BUCKET } from "../../keys.json";
import { Request } from "express";
import { workoutLog } from "../models/workoutLog";

const megaByte: number = 1000000;

AWS.config.loadFromPath(path.resolve(__dirname, "..", "..", "keys.json"));
const s3: AWS.S3 = new AWS.S3();

type videoFileMimeType = "video/quicktime" | "video/mp4" | "video/x-msvideo";

function fileFilter(
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  const validFileTypes: videoFileMimeType[] = [
    "video/quicktime",
    "video/mp4",
    "video/x-msvideo",
  ];
  if (
    !validFileTypes.includes(file.mimetype as videoFileMimeType) ||
    !req.body.workoutLog
  ) {
    callback(null, false);
  } else {
    if (typeof req.body.workoutLog === "string")
      req.body.workoutLog = JSON.parse(req.body.workoutLog);
    callback(null, true);
  }
}

function setFileKey(
  req: Request,
  file: Express.Multer.File,
  callback: (error: any, key?: string | undefined) => void
): void {
  const workoutLog: workoutLog = req.body.workoutLog;
  const fileExtension: string | undefined = file.originalname.split(".").pop();
  if (!fileExtension) callback(new Error("Invalid file type"));
  for (const exercise of workoutLog.exercises) {
    for (const set of exercise.sets) {
      if (set.formVideo === file.originalname) {
        const timeStamp = Date.now().toString();
        const fileName = [timeStamp, fileExtension].join(".");
        set.formVideo = fileName;
        callback(null, `${req.currentUser?.id}/${fileName}`);
        return;
      }
    }
  }
  callback(new Error("File not found on log data."));
}

export const uploadS3 = multer({
  storage: multerS3({
    s3,
    bucket: WLOGGER_BUCKET,
    key: setFileKey,
    serverSideEncryption: "AES256",
  }),
  limits: { fileSize: 50 * megaByte },
  fileFilter,
});

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
