import { Request, Response } from "express";
import { ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import {
  loggedExerciseDocument,
  loggedSetDocument,
  videoFileExtension,
  WorkoutLog,
  workoutLogDocument,
  workoutLogHeaderData,
} from "../models/workoutLog";
import { S3 } from "../config/aws";
import { WLOGGER_BUCKET } from "../config/env";
import { pipeline } from "stream";
import { PresignedPost } from "aws-sdk/clients/s3";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const workoutLog: workoutLogDocument = await WorkoutLog.create(req.body);
    const user = req.currentUser as userDocument;
    user.workoutLogs.unshift(workoutLog._id);
    await user.save();
    const signedPostUrls: PresignedPost[] = workoutLog.generateSignedUrls(
      req.currentUser?.id
    );
    res
      .status(201)
      .json({ ...workoutLog.toObject(), uploadUrls: signedPostUrls });
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
  await user
    .populate({ path: "workoutLogs", options: { sort: { createdAt: -1 } } })
    .execPopulate();
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
  req: Request,
  res: Response<string>
): Promise<void> {
  const user = req.currentUser as userDocument;
  const workoutLogToDelete = req.currentWorkoutLog as workoutLogDocument;
  const workoutLogToDeleteIndex: number | undefined =
    user.workoutLogs.findIndex(
      (workoutLog: workoutLogDocument) =>
        workoutLog.toString() === workoutLogToDelete.id
    );
  user.workoutLogs.splice(workoutLogToDeleteIndex, 1);
  await Promise.all([
    workoutLogToDelete.deleteAllSetVideos(user.id),
    user.save(),
    workoutLogToDelete.delete(),
  ]);
  res.json(workoutLogToDelete.id);
}

export async function showSetVideo(
  req: Request<{ setId: string; exerciseId: string; id: string }>,
  res: Response
): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  const { setId, exerciseId } = req.params;
  const exercise: loggedExerciseDocument | undefined =
    workoutLog.exercises.find((exercise) => exercise.id === exerciseId);
  const set: loggedSetDocument | undefined = exercise?.sets.find(
    (set) => set.id === setId
  );

  if (!set || !set.formVideoExtension) {
    res.status(404).json();
    return;
  }

  const fileSize: number = await workoutLog.getVideoFileSize(
    req.currentUser?.id,
    exercise?.id,
    set
  );

  if (fileSize === 0) {
    res.status(404).json();
    return;
  }

  const fileExtension: videoFileExtension | undefined = set.formVideoExtension;
  const displayFileName = workoutLog.generateSetVideoDisplayFileName(
    exerciseId,
    setId
  );

  res.attachment(displayFileName);
  res.contentType(fileExtension);
  if (req.headers.range)
    writeVideoStreamHeaders(res, fileSize, req.headers.range);

  const videoKey: string = `${req.currentUser?.id}/${workoutLog.id}/${exerciseId}.${setId}.${fileExtension}`;

  pipeline(
    createS3VideoStream(videoKey, req.headers.range),
    res,
    (err: NodeJS.ErrnoException | null) => {}
  );
}

function createS3VideoStream(videoKey: string, range?: string) {
  return S3.getObject({
    Bucket: WLOGGER_BUCKET,
    Key: videoKey,
    Range: range,
  }).createReadStream();
}

function writeVideoStreamHeaders(
  res: Response,
  totalFileSize: number,
  range: string
): void {
  // example range header: bytes=100-300
  const bytes = range.replace(/bytes=/, "").split("-");
  const rangeStart: number = parseInt(bytes[0], 10);
  const rangeEnd: number = bytes[1]
    ? parseInt(bytes[1], 10)
    : totalFileSize - 1;
  const chunkSize: number = rangeEnd - rangeStart + 1;

  const headers = {
    "Accept-Ranges": "bytes",
    "Content-Length": chunkSize,
    "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${totalFileSize}`,
    "Content-Disposition": "inline",
  };

  res.writeHead(206, headers);
}

export async function destroySetVideo(
  req: Request<{ setId: string; exerciseId: string; id: string }>,
  res: Response<{ setId: string; exerciseId: string }>
): Promise<void> {
  const workoutLog = req.currentWorkoutLog as workoutLogDocument;
  const { setId, exerciseId } = req.params;
  const videoDeleted: boolean = await workoutLog.deleteSetVideo(
    exerciseId,
    setId,
    req.currentUser?.id
  );
  if (!videoDeleted) {
    res.status(404).json();
    return;
  }
  res.json({ setId, exerciseId });
}
