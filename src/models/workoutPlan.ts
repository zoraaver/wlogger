import { Document, Schema, model } from "mongoose";
import { Day, daysToNumbers, workoutDocument } from "./workout";
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
  findNextWorkout: (
    weekDifference: number,
    dayOfWeek: Day
  ) => workoutDocument | string;
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

workoutPlanSchema.methods.findNextWorkout = function (
  weekDifference: number,
  dayOfWeek: Day
): workoutDocument | string {
  this.modifyPositionsToIncludePreviousWeekRepeats();
  const weeks: Week[] = this.weeks;
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
};

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

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
