import { Request, Response, NextFunction } from "express";
import { User, userDocument } from "../models/user";
import { workoutPlanDocument, WorkoutPlan } from "../models/workoutPlan";

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { name, length, current } = req.body;
  try {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create({
      name,
      length,
      current,
    });
    const user: userDocument | null = await User.findById(req.currentUserId);
    user?.workoutPlans.push(workoutPlan._id.toString());
    if (current && user) user.currentWorkoutPlan = workoutPlan._id;
    await user?.save();
    res.status(201).json({ workoutPlan });
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}
