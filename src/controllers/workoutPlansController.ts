import { Request, Response } from "express";
import { LeanDocument } from "mongoose";
import { ResponseError, ResponseMessage } from "../../@types";
import { User, userDocument } from "../models/user";
import {
  workoutPlanDocument,
  WorkoutPlan,
  workoutPlanStatus,
  WorkoutDateResult,
} from "../models/workoutPlan";
import {
  dateDifferenceInWeeks,
  findDuplicatePositionsInWeeks,
  goBackToPreviousMonday,
} from "../util/util";

export async function create(
  req: Request,
  res: Response<workoutPlanDocument | ResponseError>
): Promise<void> {
  const { current, weeks } = req.body;
  try {
    if (weeks !== undefined) {
      findDuplicatePositionsInWeeks(weeks);
    }
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create(req.body);
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
    .populate("workoutPlans", "name status start end weeks.repeat");
  const workoutPlans = user?.workoutPlans;
  if (workoutPlans) {
    res.json(workoutPlans);
  } else {
    res.status(500).json({ message: "An error occured" });
  }
}

export async function show(
  req: Request<{ id: string }>,
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
  req: Request<{ id: string }>,
  res: Response<workoutPlanDocument | ResponseMessage | ResponseError>
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
  try {
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOneAndUpdate(
      { _id: user.workoutPlans[0].id },
      req.body,
      { new: true, runValidators: true }
    );
    if (workoutPlan) res.json(workoutPlan);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}

export async function destroy(
  req: Request<{ id: string }>,
  res: Response<string | ResponseMessage>
): Promise<void> {
  const { id } = req.params;
  const user = await User.findById(req.currentUserId).populate(
    "workoutPlans",
    "_id"
  );

  const workoutPlanIndex: number | undefined = user?.workoutPlans.findIndex(
    (workoutPlan: workoutPlanDocument) => workoutPlan.id === id
  );

  if (!user || workoutPlanIndex === undefined || workoutPlanIndex < 0) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }

  // remove workout plan from user doc
  user.workoutPlans.splice(workoutPlanIndex, 1);
  if (user.currentWorkoutPlan && user.currentWorkoutPlan.toString() === id) {
    user.currentWorkoutPlan = undefined;
  }
  await Promise.all([user.save(), WorkoutPlan.findByIdAndDelete(id)]);
  res.json(id);
}

export async function start(
  req: Request<{ id: string }>,
  res: Response<{ id: string; start: Date } | string | ResponseMessage>
) {
  const { id } = req.params;
  const user: userDocument | null = await User.findById(
    req.currentUserId,
    "workoutPlans password googleId"
  )
    .populate({
      path: "workoutPlans",
      match: { _id: { $eq: id } },
      select: "_id weeks.repeat",
    })
    .populate("currentWorkoutPlan", "status");

  if (!user || user.workoutPlans.length === 0) {
    res.status(404).json({ message: `Cannot find workout plan with id ${id}` });
    return;
  }
  if (!user.currentWorkoutPlan) user.currentWorkoutPlan = user.workoutPlans[0];
  const previousWorkoutPlan: workoutPlanDocument = user.currentWorkoutPlan;
  previousWorkoutPlan.status = "Not started";
  await previousWorkoutPlan.save();
  user.currentWorkoutPlan = user.workoutPlans[0];
  user.currentWorkoutPlan.status = "In progress" as workoutPlanStatus;
  user.currentWorkoutPlan.start = Date.now();
  await Promise.all([
    user.currentWorkoutPlan.save(),
    user.updateOne({ currentWorkoutPlan: user.currentWorkoutPlan }),
  ]);
  res.json({
    id: user.currentWorkoutPlan._id.toString(),
    start: user.currentWorkoutPlan.start,
  });
}

export async function nextWorkout(
  req: Request,
  res: Response<WorkoutDateResult>
): Promise<void> {
  const user: userDocument | null = await User.findById(
    req.currentUserId,
    "currentWorkoutPlan"
  ).populate("currentWorkoutPlan");
  const currentWorkoutPlan: workoutPlanDocument = user?.currentWorkoutPlan;
  if (!currentWorkoutPlan || !user) {
    res.status(404).json("No current workout plan found.");
    return;
  }
  const today: Date = new Date(Date.now());
  let weekDifference: number = dateDifferenceInWeeks(
    goBackToPreviousMonday(currentWorkoutPlan.start),
    today
  );
  const result: WorkoutDateResult = currentWorkoutPlan.findNextWorkout(
    weekDifference
  );
  if (typeof result === "string") {
    res.json(result);
  } else {
    res.json({ ...result.workout?.toJSON(), date: result.date });
  }
}

export async function current(
  req: Request,
  res: Response<string | workoutPlanDocument>
): Promise<void> {
  const user: userDocument | null = await User.findById(
    req.currentUserId,
    "currentWorkoutPlan"
  ).populate("currentWorkoutPlan");
  const currentWorkoutPlan: workoutPlanDocument = user?.currentWorkoutPlan;
  if (!currentWorkoutPlan) {
    res.status(404).json("No current workout plan found.");
    return;
  }
  res.json(currentWorkoutPlan);
}
