import { ObjectID } from "bson";
import { Document, model, Schema } from "mongoose";
import { weightUnit, workoutDocument } from "./workout";

export type workoutLog = {
  createdAt: Date;
  updatedAt: Date;
  workoutId: workoutDocument["_id"];
  exercises: Array<loggedExercise>;
  calculateSetNumber: () => number;
  generateWorkoutLogHeaderData: () => workoutLogHeaderData;
};

export type workoutLogDocument = Document & workoutLog;

export interface workoutLogHeaderData {
  createdAt: Date;
  setCount: number;
  exerciseCount: number;
  _id: string;
}

export interface loggedExercise {
  name: string;
  exerciseId?: ObjectID;
  sets: Array<{
    weight: number;
    unit: weightUnit;
    repetitions: number;
    restInterval: number;
  }>;
}

const weightUnits: weightUnit[] = ["kg", "lb"];

const workoutLogSchema = new Schema<workoutLogDocument>(
  {
    workoutId: { type: Schema.Types.ObjectId, ref: "Workout" },
    exercises: [
      {
        name: { type: String, required: [true, "Name is a required field"] },
        exerciseId: { type: Schema.Types.ObjectId },
        sets: [
          {
            weight: { type: Number, default: 0 },
            restInterval: { type: Number, default: 0 },
            unit: {
              type: String,
              required: [true, "Unit is a required field"],
              enum: {
                values: weightUnits,
                message: "Unit must be one of 'kg' or 'lb'",
              },
            },
            repetitions: { type: Number, default: 0 },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

workoutLogSchema.methods.generateWorkoutLogHeaderData = function (): workoutLogHeaderData {
  return {
    createdAt: this.createdAt,
    setCount: this.calculateSetNumber(),
    exerciseCount: this.exercises.length,
    _id: this._id,
  };
};

workoutLogSchema.methods.calculateSetNumber = function (): number {
  return this.exercises.reduce(
    (total: number, curr: loggedExercise) => total + curr.sets.length,
    0
  );
};

export const WorkoutLog = model<workoutLogDocument>(
  "WorkoutLog",
  workoutLogSchema
);
