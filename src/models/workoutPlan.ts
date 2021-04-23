import { Document, Schema, model } from "mongoose";
import { dateDifferenceInWeeks, goBackToPreviousMonday } from "../util/util";
import { Day, days, daysToNumbers, workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export type workoutPlanStatus = "In progress" | "Completed" | "Not started";
const workoutPlanStatuses: workoutPlanStatus[] = [
  "Completed",
  "In progress",
  "Not started",
];

export interface Week {
  position: number;
  workouts: Array<workoutDocument>;
  repeat: number;
}

export interface workoutPlanDocument extends Document {
  name: string;
  start: Date;
  end: Date;
  status: workoutPlanStatus;
  weeks: Array<Week>;
  modifyPositionsToIncludePreviousWeekRepeats: () => void;
  findNextWorkout: () => WorkoutDateResult;
  findWorkoutInUpcomingWeeks: (
    weekIndex: number,
    weekDifference: number
  ) => WorkoutDateResult;
  findCurrentWeekIndex: (weekDifference: number) => number;
  isCompleted: (weekDifference: number) => boolean;
  calculateWeekDifference: () => number;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: [true, "Name is a required field"] },
  status: {
    type: String,
    enum: {
      values: workoutPlanStatuses,
      message:
        "Status must be one of 'Completed', 'In Progress' or 'Not started'",
    },
    default: "Not started",
  },
  start: Date,
  end: Date,
  weeks: [
    {
      position: {
        type: Number,
        required: [true, "Position is a required field"],
        min: 0,
      },
      workouts: [workoutSchema],
      repeat: { type: Number, default: 0 },
    },
  ],
});

workoutPlanSchema.methods.modifyPositionsToIncludePreviousWeekRepeats = function (): void {
  this.weeks.sort((a: Week, b: Week) => a.position - b.position);
  let actualPosition: number = 1;
  for (const week of this.weeks) {
    week.position = actualPosition;
    actualPosition = actualPosition + week.repeat + 1;
  }
};

export type WorkoutDateResult =
  | string
  | {
      workout?: workoutDocument;
      date?: Date;
    };

workoutPlanSchema.methods.calculateWeekDifference = function (): number {
  const today: Date = new Date(Date.now());
  const weekDifference: number = dateDifferenceInWeeks(
    goBackToPreviousMonday(this.start),
    today
  );
  return weekDifference;
};

workoutPlanSchema.methods.findNextWorkout = function (): WorkoutDateResult {
  this.modifyPositionsToIncludePreviousWeekRepeats();
  const weekDifference: number = this.calculateWeekDifference();
  if (this.isCompleted(weekDifference)) {
    return "Completed";
  }
  const weekIndex: number = this.findCurrentWeekIndex(weekDifference);
  const currentWeek: Week = this.weeks[weekIndex];

  const repeatWeeksRemaining: number =
    currentWeek.repeat + currentWeek.position - weekDifference - 1;

  const { workout, date } = findWorkoutInCurrentWeek(
    currentWeek,
    repeatWeeksRemaining
  );
  if (workout && date) return { workout, date };

  return this.findWorkoutInUpcomingWeeks(weekIndex, weekDifference);
};

workoutPlanSchema.methods.isCompleted = function (weekDifference: number) {
  const lastWeek: Week = this.weeks[this.weeks.length - 1];
  if (weekDifference >= lastWeek.position + lastWeek.repeat) {
    return true;
  }
  return false;
};

workoutPlanSchema.methods.findCurrentWeekIndex = function (
  weekDifference: number
): number {
  let weekIndex: number = 0;
  // increment index till it matches the current week
  while (
    this.weeks[weekIndex].position + this.weeks[weekIndex].repeat <
    weekDifference + 1
  ) {
    ++weekIndex;
  }
  return weekIndex;
};

function findWorkoutInCurrentWeek(
  week: Week,
  repeatWeeksRemaining: number
): { workout?: workoutDocument; date?: Date } {
  if (week.workouts.length === 0) return {};
  const currentDate: Date = new Date(Date.now());
  const currentDay: Day = days[currentDate.getDay()];
  let date: Date | undefined;
  let workout = week.workouts.find(
    (w: workoutDocument) =>
      daysToNumbers[w.dayOfWeek] >= daysToNumbers[currentDay]
  );
  sortWorkoutsByDayOfWeek(week);
  date = workout?.calculateDate(0);
  if (!workout && repeatWeeksRemaining !== 0) {
    workout = week.workouts[0];
    date = workout.calculateDate(repeatWeeksRemaining);
  }
  if (workout) {
    return { workout, date };
  }
  return {};
}

workoutPlanSchema.methods.findWorkoutInUpcomingWeeks = function (
  weekIndex: number,
  weekDifference: number
): WorkoutDateResult {
  let workout: workoutDocument | undefined = undefined;
  while (workout === undefined) {
    ++weekIndex;
    if (weekIndex >= this.weeks.length)
      return "All workouts in the plan have been completed.";
    const week: Week = this.weeks[weekIndex];
    // make sure workouts are sorted by day of week
    sortWorkoutsByDayOfWeek(week);
    if (week.workouts.length > 0) {
      workout = week.workouts[0];
      return {
        workout,
        date: workout.calculateDate(week.position - 1 - weekDifference),
      };
    }
  }
  return {};
};

function sortWorkoutsByDayOfWeek(week: Week): void {
  week.workouts.sort(
    (a: workoutDocument, b: workoutDocument) =>
      daysToNumbers[a.dayOfWeek] - daysToNumbers[b.dayOfWeek]
  );
}

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
