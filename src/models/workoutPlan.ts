import { Document, Schema, model } from "mongoose";
import { workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export interface workoutPlanDocument extends Document {
  name: string;
  length: number;
  weeks: { position: number; workouts: Array<workoutDocument> };
  current: boolean;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: [true, "Name is a required field"] },
  length: Number,
  workouts: [{ position: Number, workouts: [workoutSchema] }],
  current: Boolean,
});

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
