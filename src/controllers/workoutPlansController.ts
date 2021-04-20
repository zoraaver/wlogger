import { Request, Response } from "express";
import { LeanDocument } from "mongoose";
import { ResponseError, ResponseMessage } from "../../@types";
import { User, userDocument } from "../models/user";
import { Day, days, workoutDocument, daysToNumbers } from "../models/workout";
import {
  workoutPlanDocument,
  WorkoutPlan,
  workoutPlanStatus,
  Week,
} from "../models/workoutPlan";

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
) {
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
  await user.save();
  await WorkoutPlan.findByIdAndDelete(id);
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
  res: Response<string | workoutDocument>
) {
  const user: userDocument | null = await User.findById(
    req.currentUserId,
    "currentWorkoutPlan"
  )
    .populate("currentWorkoutPlan")
    .lean();
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
  modifyPositionsToIncludePreviousWeekRepeats(currentWorkoutPlan.weeks);
  const workout: string | workoutDocument = findNextWorkout(
    currentWorkoutPlan,
    weekDifference,
    days[today.getDay()]
  );
  res.json(workout);
}

function dateDifferenceInWeeks(d1: Date, d2: Date): number {
  const millisecondsInWeek: number = 1000 * 60 * 60 * 24 * 7;
  return Math.floor(
    (Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate()) -
      Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate())) /
      millisecondsInWeek
  );
}

function goBackToPreviousMonday(date: Date): Date {
  const day: number = date.getDay();
  let dayDifference: number = day - 1;
  if (dayDifference < 0) dayDifference = 6;
  const millisecondsInDay: number = 1000 * 60 * 60 * 24;
  let timeDifference: number = dayDifference * millisecondsInDay;
  date.setTime(date.getTime() - timeDifference);
  return date;
}

function modifyPositionsToIncludePreviousWeekRepeats(weeks: Week[]): void {
  weeks.sort((a: Week, b: Week) => a.position - b.position);
  let actualPosition: number = 1;
  for (const week of weeks) {
    week.position = actualPosition;
    actualPosition = actualPosition + week.repeat + 1;
  }
}

function findNextWorkout(
  workoutPlan: workoutPlanDocument,
  weekDifference: number,
  dayOfWeek: Day
): workoutDocument | string {
  const weeks: Week[] = workoutPlan.weeks;
  const lastWeek: Week = weeks[weeks.length - 1];
  if (weekDifference >= lastWeek.position + lastWeek.repeat) return "Completed";
  let weekIndex: number = 0;
  // increment index till it matches the current week
  while (
    weeks[weekIndex].position + weeks[weekIndex].repeat <
    weekDifference + 1
  ) {
    ++weekIndex;
  }
  const currentWeek: Week = weeks[weekIndex];
  const repeatWeeksRemaining: number =
    currentWeek.repeat + currentWeek.position - weekDifference - 1;
  // look for workout in current week with a day of week greater than or equal to current day of week
  let workout: workoutDocument | undefined = findWorkoutInCurrentWeek(
    currentWeek,
    dayOfWeek,
    repeatWeeksRemaining
  );
  if (workout) return workout;
  // otherwise search following weeks
  return findWorkoutInUpcomingWeeks(weekIndex, weeks);
}

function findWorkoutInCurrentWeek(
  week: Week,
  dayOfWeek: Day,
  repeatWeeksRemaining: number
): workoutDocument | undefined {
  if (week.workouts.length === 0) return undefined;
  let workout = week.workouts.find(
    (w: workoutDocument) =>
      daysToNumbers[w.dayOfWeek] >= daysToNumbers[dayOfWeek]
  );
  sortWorkoutsByDayOfWeek(week);
  if (!workout && repeatWeeksRemaining !== 0) {
    workout = week.workouts[0];
  }
  return workout;
}

function findWorkoutInUpcomingWeeks(
  weekIndex: number,
  weeks: Week[]
): string | workoutDocument {
  let workout: workoutDocument | undefined = undefined;
  while (workout === undefined) {
    ++weekIndex;
    if (weekIndex >= weeks.length)
      return "All workouts in the plan have been completed.";
    // make sure workouts are sorted by day of week
    sortWorkoutsByDayOfWeek(weeks[weekIndex]);
    if (weeks[weekIndex].workouts.length > 0)
      workout = weeks[weekIndex].workouts[0];
  }
  return workout;
}

function sortWorkoutsByDayOfWeek(week: Week): void {
  week.workouts.sort(
    (a: workoutDocument, b: workoutDocument) =>
      daysToNumbers[a.dayOfWeek] - daysToNumbers[b.dayOfWeek]
  );
}
