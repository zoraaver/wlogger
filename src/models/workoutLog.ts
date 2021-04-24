import { Document, model, Schema } from "mongoose";
import { weightUnit, weightUnits } from "./workout";

export type workoutLog = {
  createdAt: Date;
  updatedAt: Date;
  exercises: Array<exercise>;
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

export interface exercise {
  name: string;
  sets: Array<{
    weight?: number;
    unit: weightUnit;
    repetitions?: number;
    restInterval?: number;
  }>;
}

const workoutLogSchema = new Schema<workoutLogDocument>(
  {
    exercises: [
      {
        name: { type: String, required: [true, "Name is a required field"] },
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
    (total: number, curr: exercise) => total + curr.sets.length,
    0
  );
};

export const WorkoutLog = model<workoutLogDocument>(
  "WorkoutLog",
  workoutLogSchema
);
