import { Document, Schema, model } from "mongoose";
import { workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export interface workoutPlanDocument extends Document {
  name: string;
  length: number;
  weeks: {
    position: number;
    workouts: Array<workoutDocument>;
    repeat: number;
  };
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: [true, "Name is a required field"] },
  length: { type: Number, default: 0 },
  weeks: [{ position: Number, workouts: [workoutSchema], repeat: Number }],
});

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
