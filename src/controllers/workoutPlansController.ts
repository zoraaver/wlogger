import { Request, Response } from "express";
import { ResponseError, ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import {
  workoutPlanDocument,
  WorkoutPlan,
  workoutPlanStatus,
  WorkoutDateResult,
  validateWeekPositions,
} from "../models/workoutPlan";

export async function create(
  req: Request,
  res: Response<workoutPlanDocument | ResponseError>
): Promise<void> {
  try {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create(req.body);
    validateWeekPositions(req.body.weeks);
    const user: userDocument = req.currentUser as userDocument;
    user.workoutPlans.push(workoutPlan._id);
    await user.save();
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
  const user = req.currentUser as userDocument;
  await user
    .populate(
      "workoutPlans",
      "name status start end weeks.repeat weeks.position"
    )
    .execPopulate();
  if (user.workoutPlans) {
    res.json(user.workoutPlans);
  } else {
    res.status(500).json({ message: "An error occured" });
  }
}

export async function show(
  req: Request<{ id: string }>,
  res: Response<workoutPlanDocument>
): Promise<void> {
  const { id } = req.params;
  const workoutPlan = (await WorkoutPlan.findById(id)) as workoutPlanDocument;
  res.json(workoutPlan);
}

export async function update(
  req: Request<{ id: string }>,
  res: Response<workoutPlanDocument | ResponseError>
): Promise<void> {
  const { id } = req.params;
  try {
    validateWeekPositions(req.body.weeks);
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findByIdAndUpdate(
      id,
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
  res: Response<string>
): Promise<void> {
  const { id } = req.params;
  const user = req.currentUser as userDocument;
  const workoutPlanIndex: number | undefined = user.workoutPlans.findIndex(
    (workoutPlan: workoutPlanDocument) => workoutPlan.toString() === id
  );
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
  res: Response<{ id: string; start: Date } | string>
) {
  const { id } = req.params;
  const user = req.currentUser as userDocument;
  await user
    .populate({
      path: "workoutPlans",
      match: { _id: { $eq: id } },
      select: "_id weeks.repeat",
    })
    .populate("currentWorkoutPlan")
    .execPopulate();
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
  const user = req.currentUser as userDocument;
  await user.populate("currentWorkoutPlan").execPopulate();
  const currentWorkoutPlan: workoutPlanDocument = user.currentWorkoutPlan;
  if (!currentWorkoutPlan) {
    res.status(404).json("No current workout plan found.");
    return;
  }
  const result: WorkoutDateResult = await currentWorkoutPlan.findNextWorkout(
    user.workoutLogs
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
  const user = req.currentUser as userDocument;
  await user
    .populate(
      "currentWorkoutPlan",
      "name status start end weeks.repeat weeks.position"
    )
    .execPopulate();
  const currentWorkoutPlan: workoutPlanDocument = user.currentWorkoutPlan;
  if (!currentWorkoutPlan) {
    res.status(404).json("No current workout plan found.");
    return;
  }
  res.json(currentWorkoutPlan);
}
