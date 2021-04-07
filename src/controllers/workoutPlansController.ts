import { Request, Response, NextFunction } from "express";
import { LeanDocument } from "mongoose";
import { User, userDocument } from "../models/user";
import { workoutPlanDocument, WorkoutPlan } from "../models/workoutPlan";

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { name, length, current, weeks } = req.body;
  try {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create({
      name,
      length,
      weeks,
    });
    const user: userDocument | null = await User.findById(req.currentUserId);
    user?.workoutPlans.push(workoutPlan._id);
    if (current && user) user.currentWorkoutPlan = workoutPlan._id;
    await user?.save();
    res.status(201).json(workoutPlan);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}

export async function index(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user: LeanDocument<userDocument> | null = await User.findById(
    req.currentUserId,
    "workoutPlans"
  )
    .lean()
    .populate("workoutPlans", "name length");
  const workoutPlans = user?.workoutPlans;
  if (workoutPlans) {
    res.json(workoutPlans);
  } else {
    res.status(500).json({ message: "An error occured" });
  }
}

export async function show(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { id } = req.params;
  const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findById(
    id
  ).lean();
  if (!workoutPlan) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  res.json(workoutPlan);
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { id } = req.params;
  const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findByIdAndUpdate(
    id,
    req.body,
    { new: true }
  );
  if (!workoutPlan) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  res.json(workoutPlan);
}

export async function destroy(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findByIdAndDelete(
    id
  ).lean();
  if (!workoutPlan) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  res.json(workoutPlan._id);
}
