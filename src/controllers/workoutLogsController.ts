import { Request, Response } from "express";
import { ResponseError, ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import {
  WorkoutLog,
  workoutLogDocument,
  workoutLogHeaderData,
} from "../models/workoutLog";

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
