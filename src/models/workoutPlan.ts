import { Document, Schema, model } from "mongoose";
import { workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export interface workoutPlanDocument extends Document {
  name: string;
  length: number;
  workouts: Array<workoutDocument>;
  current: boolean;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: true },
  length: { type: String, required: true },
  workouts: [workoutSchema],
  current: Boolean,
});

export default model<workoutPlanDocument>("WorkoutPlan", workoutPlanSchema);
