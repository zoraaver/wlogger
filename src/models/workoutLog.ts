import { Document, model, Schema } from "mongoose";

export interface workoutLogDocument extends Document {
  createdAt: Date;
  updatedAt: Date;
  exercises: Array<{
    name: string;
    sets: number[];
    weight: number;
    restInterval: number;
  }>;
}

const workoutLogSchema = new Schema<workoutLogDocument>(
  {
    exercises: [
      {
        name: { type: String, required: [true, "Name is a required field"] },
        sets: [Number],
        weight: { type: Number, default: 0 },
        restInterval: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

export const WorkoutLog = model<workoutLogDocument>(
  "WorkoutLog",
  workoutLogSchema
);
