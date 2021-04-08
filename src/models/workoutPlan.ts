import { Document, Schema, model } from "mongoose";
import { workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export interface workoutPlanDocument extends Document {
  name: string;
  length: number;
  weeks: Array<{
    position: number;
    workouts: Array<workoutDocument>;
    repeat: number;
  }>;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: [true, "Name is a required field"] },
  length: {
    type: Number,
    cast: "Length must be a number",
    default: 0,
    min: [0, "Length must be a non-negative integer"],
  },
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

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
