import { Request, Response } from "express";
import { ResponseError } from "../../@types";
import { User, userDocument } from "../models/user";
import { WorkoutLog, workoutLogDocument } from "../models/workoutLog";

export async function create(
  req: Request,
  res: Response<workoutLogDocument | ResponseError>
): Promise<void> {
  try {
    const workoutLog: workoutLogDocument = await WorkoutLog.create(req.body);
    const user: userDocument | null = await User.findById(req.currentUserId);
    user?.workoutLogs.push(workoutLog._id);
    await user?.save();
    res.status(201).json(workoutLog);
  } catch (error) {
    res.json(error.message);
  }
}

export async function index(req: Request, res: Response): Promise<void> {}
