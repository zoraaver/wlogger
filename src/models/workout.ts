import { ObjectID } from "bson";
import { Document, Schema } from "mongoose";
import {
  Day,
  days,
  daysToNumbers,
  getCurrentWeekDay,
  millisecondsInDay,
  millisecondsInWeek,
} from "../util/util";
import {
  loggedExerciseDocument,
  WorkoutLog,
  workoutLogDocument,
} from "./workoutLog";

export type incrementField = "weight" | "repetitions" | "sets";
export const incrementFields: incrementField[] = [
  "repetitions",
  "sets",
  "weight",
];

export type weightUnit = "kg" | "lb";
const weightUnits: weightUnit[] = ["kg", "lb"];

export interface workoutDocument extends Document {
  dayOfWeek: Day;
  calculateDate: (weeksIntoFuture: number) => Date;
  applyIncrements: (workoutLogs: ObjectID[]) => Promise<void>;
  findMatchingWorkoutLogsOneWeekAgo: (
    workoutLogs: ObjectID[]
  ) => Promise<workoutLogDocument[]>;
  exercises: Array<workoutExercise>;
}

interface workoutExercise {
  _id: ObjectID;
  name: string;
  restInterval: number;
  sets: number;
  repetitions: number;
  weight: number;
  unit: weightUnit;
  autoIncrement?: { field: incrementField; amount: number };
}

export const workoutSchema = new Schema<workoutDocument>({
  dayOfWeek: {
    type: String,
    required: [true, "Day of the week is required"],
    enum: { values: days, message: "Invalid day of week" },
  },
  exercises: [
    {
      name: { type: String, required: [true, "Exercise name is required"] },
      restInterval: Number,
      sets: {
        type: Number,
        required: true,
        min: [1, "Sets must be a positive integer"],
      },
      repetitions: {
        type: Number,
        min: [0, "Repetitions must be a non-negative integer"],
        default: 0,
      },
      weight: {
        type: Number,
        min: [0, "Weight must be a non-negative number"],
        default: 0,
      },
      unit: {
        type: String,
        enum: {
          values: weightUnits,
          message: "Unit must be one of 'kg' or 'lb'",
        },
      },
      autoIncrement: {
        field: {
          type: String,
          enum: {
            values: incrementFields,
            message:
              "Increment field must be one of 'weight', 'repetitions' or 'sets'",
          },
        },
        amount: {
          type: Number,
          min: [0, "Increment amount must be non-negative"],
        },
      },
    },
  ],
});

workoutSchema.methods.calculateDate = function (weeksIntoFuture: number): Date {
  const currentWeekDay: Day = getCurrentWeekDay();

  const daysIntoFuture: number =
    daysToNumbers[this.dayOfWeek] - daysToNumbers[currentWeekDay];

  return new Date(
    Date.now() +
      weeksIntoFuture * millisecondsInWeek +
      daysIntoFuture * millisecondsInDay
  );
};

workoutSchema.methods.applyIncrements = async function (
  workoutLogIds: ObjectID[]
) {
  const workoutLogsOneWeekAgo: workoutLogDocument[] =
    await this.findMatchingWorkoutLogsOneWeekAgo(workoutLogIds);

  if (workoutLogsOneWeekAgo.length > 0) {
    const lastLog: workoutLogDocument =
      workoutLogsOneWeekAgo[workoutLogsOneWeekAgo.length - 1];

    lastLog.exercises.forEach((loggedExercise: loggedExerciseDocument) => {
      this.exercises.forEach((exercise) => {
        applyIncrements(loggedExercise, exercise);
      });
    });
  }
};

function applyIncrements(
  loggedExercise: loggedExerciseDocument,
  exercise: workoutExercise
) {
  const exercisesMatch =
    exercise._id.toString() === loggedExercise.exerciseId?.toString();

  if (!exercise.autoIncrement || !exercisesMatch) return;

  if (lastLogReachedWorkoutGoal(exercise, loggedExercise)) {
    if (exercise.autoIncrement.field === "sets") {
      exercise.sets =
        loggedExercise.sets.length + exercise.autoIncrement.amount;
    } else {
      const lastSet = loggedExercise.sets[loggedExercise.sets.length - 1];

      exercise[exercise.autoIncrement.field] =
        lastSet[exercise.autoIncrement.field] + exercise.autoIncrement.amount;
    }
  }
}

workoutSchema.methods.findMatchingWorkoutLogsOneWeekAgo = async function (
  workoutLogIds: ObjectID[]
): Promise<workoutLogDocument[]> {
  const oneWeekAgo: Date = new Date(Date.now() - millisecondsInWeek);

  const startOfDayOneWeekAgo: Date = new Date(oneWeekAgo.setHours(0, 0, 0, 0));
  const endOfDayOneWeekAgo: Date = new Date(
    oneWeekAgo.setHours(23, 59, 59, 999)
  );

  return await WorkoutLog.find({
    createdAt: { $gte: startOfDayOneWeekAgo, $lte: endOfDayOneWeekAgo },
    workoutId: this._id,
    _id: { $in: workoutLogIds },
  });
};

function lastLogReachedWorkoutGoal(
  exercise: workoutExercise,
  loggedExercise: loggedExerciseDocument
): boolean {
  if (loggedExercise.sets.length < exercise.sets) return false;

  for (const loggedSet of loggedExercise.sets) {
    if (
      loggedSet.repetitions < exercise.repetitions ||
      loggedSet.weight < exercise.weight
    ) {
      return false;
    }
  }
  return true;
}
