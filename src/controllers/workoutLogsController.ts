import { Request, Response } from "express";
import { ResponseError, ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import { exercise, WorkoutLog, workoutLogDocument } from "../models/workoutLog";

export interface workoutLogHeaderData {
  createdAt: Date;
  setCount: number;
  exerciseCount: number;
  _id: string;
}

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
  user.populate("workoutLogs");
  await user.execPopulate();
  if (user) {
    res.json(generateWorkoutLogHeaderData(user.workoutLogs));
  } else {
    res.status(500).json({ message: "An error occurred" });
  }
}

function calculateSetNumber(exercises: exercise[]): number {
  return exercises.reduce(
    (total: number, curr: exercise) => total + curr.sets.length,
    0
  );
}

function generateWorkoutLogHeaderData(
  workoutLogs: workoutLogDocument[]
): workoutLogHeaderData[] {
  return workoutLogs.map(
    ({ createdAt, exercises, _id }: workoutLogDocument) => {
      const setCount = calculateSetNumber(exercises);
      return { createdAt, setCount, exerciseCount: exercises.length, _id };
    }
  );
}

export async function show(
  req: Request<{ id: string }>,
  res: Response<workoutLogDocument | ResponseMessage>
): Promise<void> {
  const { id } = req.params;
  const user = req.currentUser as userDocument;
  user.populate({
    path: "workoutLogs",
    match: { _id: { $eq: id } },
  });
  await user.execPopulate();
  if (user.workoutLogs.length === 0) {
    res.status(404).json({ message: `Cannot find workout log with id ${id}` });
    return;
  }
  res.json(user.workoutLogs[0]);
}

export async function destroy(
  req: Request<{ id: string }>,
  res: Response<string | ResponseMessage>
): Promise<void> {
  const { id } = req.params;
  const user = req.currentUser as userDocument;
  const workoutLogToDeleteIndex:
    | number
    | undefined = user.workoutLogs.findIndex(
    (workoutLog: workoutLogDocument) => workoutLog.toString() === id
  );
  if (workoutLogToDeleteIndex === undefined || workoutLogToDeleteIndex < 0) {
    res.status(404).json({ message: `Cannot find workout log with id ${id}` });
    return;
  }
  user.workoutLogs.splice(workoutLogToDeleteIndex, 1);
  await Promise.all([user.save(), WorkoutLog.findByIdAndDelete(id)]);
  res.json(id);
}
