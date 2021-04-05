import { Request, Response, NextFunction } from "express";
import { User, userDocument } from "../models/user";
import { workoutPlanDocument, WorkoutPlan } from "../models/workoutPlan";

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { name, length } = req.body;
  try {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create({
      name,
      length,
    });
    const user: userDocument | null = await User.findById(req.currentUserId);
    user?.workoutPlans.push(workoutPlan._id.toString());
    await user?.save();
    res.status(201).json({ workoutPlan });
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}
