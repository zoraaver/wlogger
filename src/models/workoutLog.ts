import { Document, model, Schema } from "mongoose";
import { weightUnit, weightUnits } from "./workout";

export interface workoutLogDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
  exercises: Array<exerciseData>;
}

export interface exerciseData {
  name: string;
  sets: Array<{
    weight: number;
    unit: weightUnit;
    repetitions: number;
    restInterval: number;
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

export const WorkoutLog = model<workoutLogDocument>(
  "WorkoutLog",
  workoutLogSchema
);
