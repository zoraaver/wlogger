import { ObjectID } from "bson";
import { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { ResponseMessage } from "../../@types";
import multer from "multer";
import multerS3 from "multer-s3";
import { WLOGGER_BUCKET } from "../../keys.json";
import {
  loggedSet,
  WorkoutLog,
  workoutLogDocument,
} from "../models/workoutLog";
import { S3 } from "../config/aws";
import { isValidFileType, isValidFileExtension } from "../util/util";

export function validateWorkoutLogId(
  req: Request<{ id?: string }>,
  res: Response<ResponseMessage>,
  next: NextFunction
) {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    res.status(406).json({ message: `${id} is an invalid id` });
    return;
  } else if (!req.currentUser?.workoutLogs.includes(new ObjectID(id), 0)) {
    res.status(404).json({ message: `Cannot find workout log with id ${id}` });
    return;
  }
  next();
}

export async function setCurrentWorkoutLog(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
) {
  if (!req.currentWorkoutLog)
    req.currentWorkoutLog = await WorkoutLog.findById(req.params.id);
  next();
}

// expect file in format {exerciseId}.{setId}.{mov|mp4|avi}
function workoutLogVideoFilter(
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  const fileParts: string[] = file.originalname.split(".");

  if (fileParts.length !== 3 || !isValidFileType(file.mimetype)) {
    callback(null, false);
  } else {
    const exerciseId = fileParts[0];
    const setId = fileParts[1];
    const fileExtension = fileParts[2];

    const set: loggedSet | undefined = workoutLog.exercises
      .find((exercise) => exercise.id === exerciseId)
      ?.sets.find((set) => set.id === setId);

    if (!set || !isValidFileExtension(fileExtension)) {
      callback(null, false);
    } else {
      callback(null, true);
    }
  }
}

function setWorkoutLogFileKey(
  req: Request<{ id: string }>,
  file: Express.Multer.File,
  callback: (error: any, key?: string | undefined) => void
): void {
  const workoutLogId = req.params.id;
  callback(null, `${req.currentUser?.id}/${workoutLogId}/${file.originalname}`);
}

const megaByte: number = 1000000;
export const S3WorkoutLogVideoUpload = multer({
  storage: multerS3({
    s3: S3,
    bucket: WLOGGER_BUCKET,
    key: setWorkoutLogFileKey,
    serverSideEncryption: "AES256",
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  limits: { fileSize: 50 * megaByte },
  fileFilter: workoutLogVideoFilter,
});
