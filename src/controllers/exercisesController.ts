import { Request, Response } from "express";
import { ResponseError } from "../../@types";
import { Exercise, exerciseDocument } from "../models/exercise";
import { userDocument } from "../models/user";

export async function index(req: Request, res: Response): Promise<void> {}

export async function create(
  req: Request<any, any, { notes?: string; name: string }>,
  res: Response<exerciseDocument | ResponseError>
): Promise<void> {
  try {
    const exercise: exerciseDocument = await Exercise.create(req.body);

    const user = req.currentUser as userDocument;
    user.exercises.unshift(exercise._id);
    await user.save();

    res.status(201).json(exercise);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}
