import { Request, Response } from "express";
import { LeanDocument } from "mongoose";
import { ResponseError, ResponseMessage } from "../../@types";
import { User, userDocument } from "../models/user";
import {
  exerciseData,
  WorkoutLog,
  workoutLogDocument,
} from "../models/workoutLog";

interface workoutLogHeaderData {
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
    const user: userDocument | null = await User.findById(req.currentUserId);
    user?.workoutLogs.unshift(workoutLog._id);
    await user?.save();
    res.status(201).json(workoutLog);
  } catch (error) {
    res.json(error.message);
  }
}

export async function index(
  req: Request,
  res: Response<workoutLogHeaderData[] | ResponseMessage>
): Promise<void> {
  const user: LeanDocument<userDocument> | null = await User.findById(
    req.currentUserId,
    "workoutLogs"
  )
    .lean()
    .populate("workoutLogs");
  if (user) {
    res.json(generateWorkoutLogHeaderData(user.workoutLogs));
  } else {
    res.status(500).json({ message: "An error occurred" });
  }
}

function calculateSetNumber(exercises: exerciseData[]): number {
  return exercises.reduce(
    (total: number, curr: exerciseData) => total + curr.sets.length,
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
