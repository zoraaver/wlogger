import { ObjectID } from "bson";
import { Request, Response, NextFunction } from "express";
import { isValidObjectId } from "mongoose";
import { ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";

export function validateWorkoutPlanId(
  req: Request<{ id?: string }>,
  res: Response<ResponseMessage>,
  next: NextFunction
) {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    res.status(406).json({ message: `${id} is an invalid id` });
    return;
  } else if (!req.currentUser?.workoutPlans.includes(new ObjectID(id), 0)) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }

  next();
}

export async function updateCurrentPlanAsCompletedIfNecessary(
  req: Request<{ id?: string }>,
  res: Response,
  next: NextFunction
) {
  const user = req.currentUser as userDocument;
  const { id } = req.params;
  if (
    user.currentWorkoutPlan &&
    (!id || id === user.currentWorkoutPlan._id.toString())
  ) {
    await user
      .populate(
        "currentWorkoutPlan",
        "status start weeks.repeat weeks.position"
      )
      .execPopulate();
    const currentWorkoutPlan = user.currentWorkoutPlan;
    const weekDifference: number = currentWorkoutPlan.calculateWeekDifference();
    const planNeedsToBeCompleted: boolean =
      currentWorkoutPlan.status !== "Completed" &&
      currentWorkoutPlan.isCompleted(weekDifference);
    if (planNeedsToBeCompleted) {
      currentWorkoutPlan.status = "Completed";
      currentWorkoutPlan.end = new Date(Date.now());
      await currentWorkoutPlan.save();
    }
  }
  next();
}
//TODO: add tests for middleware functions
