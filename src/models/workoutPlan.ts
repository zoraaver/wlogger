import { ObjectID } from "bson";
import { Document, Schema, model } from "mongoose";
import {
  dateDifferenceInWeeks,
  Day,
  daysToNumbers,
  getCurrentWeekDay,
  goBackToPreviousMonday,
} from "../util/util";
import { workoutDocument } from "./workout";
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
  findNextWorkout: (workoutLogs: ObjectID[]) => Promise<WorkoutDateResult>;
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
        min: 1,
      },
      workouts: [workoutSchema],
      repeat: { type: Number, default: 0 },
    },
  ],
});

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

workoutPlanSchema.methods.findNextWorkout = async function (
  workoutLogs: ObjectID[]
): Promise<WorkoutDateResult> {
  const weekDifference: number = this.calculateWeekDifference();

  if (this.isCompleted(weekDifference)) {
    return "Completed";
  }

  const weekIndex: number = this.findCurrentWeekIndex(weekDifference);
  const currentWeek: Week = this.weeks[weekIndex];

  const repeatWeeksRemaining: boolean =
    currentWeek.repeat + currentWeek.position - weekDifference - 1 > 0;

  const { workout, date } = findWorkoutInCurrentWeek(
    currentWeek,
    repeatWeeksRemaining
  );

  if (workout && date) {
    if (currentWeek.repeat) await workout.applyIncrements(workoutLogs);
    return { workout, date };
  }

  return this.findWorkoutInUpcomingWeeks(weekIndex, weekDifference);
};

workoutPlanSchema.methods.isCompleted = function (weekDifference: number) {
  if (!this.weeks || this.weeks.length === 0) return true;

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
  repeatWeeksRemaining: boolean
): { workout?: workoutDocument; date?: Date } {
  if (week.workouts.length === 0) return {};

  const currentWeekDay: Day = getCurrentWeekDay();
  let date: Date | undefined;

  let workout = week.workouts.find(
    (w: workoutDocument) =>
      daysToNumbers[w.dayOfWeek] >= daysToNumbers[currentWeekDay]
  );

  sortWorkoutsByDayOfWeek(week);
  date = workout?.calculateDate(0);

  if (!workout && repeatWeeksRemaining) {
    workout = week.workouts[0];
    date = workout.calculateDate(1);
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

  while (workout === undefined && ++weekIndex < this.weeks.length) {
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

  return "All workouts in the plan have been completed.";
};

export function validateWeekPositions(weeks?: Week[]): void {
  if (!weeks) return;

  weeks.sort((a: Week, b: Week) => a.position - b.position);

  let actualPosition: number = 1;

  weeks.forEach((week: Week, weekIndex: number) => {
    if (week.position !== actualPosition) {
      throw new Error(
        `Validation error: weeks.${weekIndex}.position: Invalid position, expected ${actualPosition}`
      );
    }

    actualPosition = actualPosition + (week.repeat ? week.repeat : 0) + 1;
  });
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

export function validateExerciseNames(
  exerciseNames: string[],
  weeks?: Week[]
): void {
  if (!weeks) return;

  weeks.forEach((week, weekIndex) => {
    week.workouts.forEach((workout, workoutIndex) => {
      workout.exercises.forEach((exercise, exerciseIndex) => {
        if (!exerciseNames.includes(exercise.name)) {
          throw new Error(
            `Validation error: weeks.${weekIndex}.workouts.${workoutIndex}.exercises.${exerciseIndex}.name: Exercise name is not valid`
          );
        }
      });
    });
  });
}
