import { Request, Response } from "express";
import { ResponseError, ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import {
  WorkoutLog,
  workoutLogDocument,
  workoutLogHeaderData,
} from "../models/workoutLog";
import { ReadStream } from "s3-streams";
import { S3 } from "../config/aws";
import { WLOGGER_BUCKET } from "../../keys.json";

export async function create(
  req: Request,
  res: Response<workoutLogDocument | ResponseError>
): Promise<void> {
  try {
    const workoutLog: workoutLogDocument = await WorkoutLog.create(req.body);
    const user = req.currentUser as userDocument;
    user.workoutLogs.unshift(workoutLog._id);
    await user.save();
    res.status(201).json(workoutLog);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}

export async function index(
  req: Request,
  res: Response<workoutLogHeaderData[] | ResponseMessage>
): Promise<void> {
  const user = req.currentUser as userDocument;
  await user.populate("workoutLogs").execPopulate();
  res.json(
    user.workoutLogs.map((workoutLog) =>
      workoutLog.generateWorkoutLogHeaderData()
    )
  );
}

export async function show(
  req: Request<{ id: string }>,
  res: Response<workoutLogDocument>
): Promise<void> {
  const { id } = req.params;
  const workoutLog: workoutLogDocument | null = (await WorkoutLog.findById(
    id
  )) as workoutLogDocument;
  res.json(workoutLog);
}

export async function destroy(
  req: Request<{ id: string }>,
  res: Response<string>
): Promise<void> {
  const { id } = req.params;
  const user = req.currentUser as userDocument;
  const workoutLogToDeleteIndex:
    | number
    | undefined = user.workoutLogs.findIndex(
    (workoutLog: workoutLogDocument) => workoutLog.toString() === id
  );
  user.workoutLogs.splice(workoutLogToDeleteIndex, 1);
  await Promise.all([user.save(), WorkoutLog.findByIdAndDelete(id)]);
  res.json(id);
}

export async function videoUpload(req: Request, res: Response): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  for (let i = 0; i < req.files.length; ++i) {
    const file: Express.Multer.File = (req.files as Express.Multer.File[])[i];
    const fileParts: string[] = file.originalname.split(".");
    const exerciseIndex = Number(fileParts[0]);
    const setIndex = Number(fileParts[1]);
    workoutLog.exercises[exerciseIndex].sets[setIndex].formVideoSize =
      file.size;
  }
  await workoutLog.save();
  res.json();
}

export async function videoDownload(
  req: Request<{ id: string; setIndex: string; exerciseIndex: string }>,
  res: Response
): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  const exerciseIndex = Number(req.params.exerciseIndex);
  const setIndex = Number(req.params.setIndex);
  if (
    !workoutLog.isValidExerciseIndex(exerciseIndex) ||
    !workoutLog.isValidSetIndex(setIndex, exerciseIndex) ||
    !workoutLog.exercises[exerciseIndex].sets[setIndex].formVideoSize
  ) {
    res.status(404).json();
    return;
  }
  const videoKey: string = `${req.currentUser?.id}/${workoutLog.id}/${exerciseIndex}.${setIndex}.mov`;
  const src: ReadStream = new ReadStream(S3, {
    Bucket: WLOGGER_BUCKET,
    Key: videoKey,
  });
  src.pipe(res);
}
