import { Request, Response } from "express";
import { ResponseError, ResponseMessage } from "../../@types";
import { userDocument } from "../models/user";
import {
  workoutPlanDocument,
  WorkoutPlan,
  workoutPlanStatus,
  WorkoutDateResult,
} from "../models/workoutPlan";

export async function create(
  req: Request,
  res: Response<workoutPlanDocument | ResponseError>
): Promise<void> {
  const { current } = req.body;
  try {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create(req.body);
    const user: userDocument = req.currentUser as userDocument;
    user.workoutPlans.push(workoutPlan._id);
    if (current) user.currentWorkoutPlan = workoutPlan._id;
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
  user.populate("workoutPlans", "name status start end weeks.repeat");
  await user.execPopulate();
  if (user.workoutPlans) {
    res.json(user.workoutPlans);
  } else {
    res.status(500).json({ message: "An error occured" });
  }
}

export async function show(
  req: Request<{ id: string }>,
  res: Response<workoutPlanDocument | ResponseMessage>
): Promise<void> {
  const { id } = req.params;
  const user = req.currentUser as userDocument;
  user.populate({
    path: "workoutPlans",
    match: { _id: { $eq: id } },
  });
  await user.execPopulate();
  if (user.workoutPlans.length === 0) {
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
  const user = req.currentUser as userDocument;
  user.populate({
    path: "workoutPlans",
    match: { _id: { $eq: id } },
    select: "_id",
  });
  await user.execPopulate();
  if (user.workoutPlans.length === 0) {
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
  const user = req.currentUser as userDocument;
  const workoutPlanIndex: number | undefined = user.workoutPlans.findIndex(
    (workoutPlan: workoutPlanDocument) => workoutPlan.toString() === id
  );

  if (workoutPlanIndex === undefined || workoutPlanIndex < 0) {
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
  const user = req.currentUser as userDocument;
  user
    .populate({
      path: "workoutPlans",
      match: { _id: { $eq: id } },
      select: "_id weeks.repeat",
    })
    .populate("currentWorkoutPlan");
  await user.execPopulate();

  if (user.workoutPlans.length === 0) {
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
  const user = req.currentUser as userDocument;
  user.populate("currentWorkoutPlan");
  await user.execPopulate();
  const currentWorkoutPlan: workoutPlanDocument = user.currentWorkoutPlan;
  if (!currentWorkoutPlan) {
    res.status(404).json("No current workout plan found.");
    return;
  }
  const result: WorkoutDateResult = currentWorkoutPlan.findNextWorkout();
  if (typeof result === "string") {
    if (result === "Completed" && currentWorkoutPlan.status !== "Completed") {
      await currentWorkoutPlan.updateOne({
        status: "Completed",
        end: new Date(Date.now()),
      });
    }
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
  user.populate("currentWorkoutPlan", "name status start end weeks.repeat");
  await user.execPopulate();
  const currentWorkoutPlan: workoutPlanDocument = user.currentWorkoutPlan;
  if (!currentWorkoutPlan) {
    res.status(404).json("No current workout plan found.");
    return;
  }
  const weekDifference: number = currentWorkoutPlan.calculateWeekDifference();
  if (
    currentWorkoutPlan.status !== "Completed" &&
    currentWorkoutPlan.isCompleted(weekDifference)
  ) {
    currentWorkoutPlan.status = "Completed";
    currentWorkoutPlan.end = new Date(Date.now());
    await currentWorkoutPlan.save();
  }
  res.json(currentWorkoutPlan);
}
