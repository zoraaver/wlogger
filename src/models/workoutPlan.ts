import { Document, Schema, model } from "mongoose";
import { workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export interface workoutPlanDocument extends Document {
  name: string;
  length: number;
  workouts: Array<workoutDocument>;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: true },
  length: { type: String, required: true },
  workouts: [workoutSchema],
});

export default model<workoutPlanDocument>("WorkoutPlan", workoutPlanSchema);
