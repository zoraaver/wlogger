import { Request, Response } from "express";
import { LeanDocument } from "mongoose";
import { User, userDocument } from "../models/user";
import { workoutPlanDocument, WorkoutPlan } from "../models/workoutPlan";

interface ResponseError {
  field: string;
  error: string;
}

interface ResponseMessage {
  message: string;
}

export async function create(
  req: Request,
  res: Response<workoutPlanDocument | ResponseError>
): Promise<void> {
  const { name, length, current, weeks } = req.body;
  try {
    if (weeks !== undefined) {
      findDuplicatePositionsInWeeks(weeks);
    }
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
  res: Response<workoutPlanDocument[] | ResponseMessage>
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
  res: Response<workoutPlanDocument | ResponseMessage>
): Promise<void> {
  const { id } = req.params;
  const user = await User.findById(req.currentUserId, "workoutPlans").populate({
    path: "workoutPlans",
    match: { _id: { $eq: id } },
  });
  if (!user || user.workoutPlans.length === 0) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  res.json(user.workoutPlans[0]);
}

export async function update(
  req: Request,
  res: Response<workoutPlanDocument | ResponseMessage>
): Promise<void> {
  const { id } = req.params;
  const user = await User.findById(req.currentUserId, "workoutPlans").populate({
    path: "workoutPlans",
    match: { _id: { $eq: id } },
    select: "_id",
  });

  if (!user || user.workoutPlans.length === 0) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOneAndUpdate(
    { _id: user.workoutPlans[0].id },
    req.body,
    { new: true }
  );
  if (workoutPlan) res.json(workoutPlan);
}

export async function destroy(
  req: Request,
  res: Response<string | ResponseMessage>
) {
  const { id } = req.params;
  const user = await User.findById(req.currentUserId, "workoutPlans").populate({
    path: "workoutPlans",
    match: { _id: { $eq: id } },
  });

  if (!user || user.workoutPlans.length === 0) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  const workoutPlan: workoutPlanDocument = user.workoutPlans[0];
  workoutPlan.delete();
  res.json(workoutPlan.id);
}

// utility function which throws an error if the input weeks array contains duplicate position fields
function findDuplicatePositionsInWeeks(weeks: any[]) {
  let positionCount: { [element: number]: number } = {};
  for (const week of weeks) {
    if (week.position !== undefined) {
      if (positionCount[week.position] === 1)
        throw new Error(
          "Validation error: weeks.position: Position must be unique for each week"
        );
      positionCount[week.position] = 1;
    }
  }
}
