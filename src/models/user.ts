import { Schema, model, Document } from "mongoose";
import { workoutPlanDocument } from "./workoutPlan";
import { workoutSessionDocument } from "./workoutSession";

export interface userDocument extends Document {
  email: string;
  password?: string;
  age?: number;
  weight?: number;
  height?: number;
  workoutPlans: Array<workoutPlanDocument["_id"]>;
  workoutSessions: Array<workoutSessionDocument["_id"]>;
}

const userSchema = new Schema<userDocument>({
  email: { type: String, required: true },
  password: { type: String },
  age: { type: Number },
  weight: Number,
  height: Number,
  workoutPlans: [
    {
      workoutPlan: { type: Schema.Types.ObjectId, ref: "workoutPlan" },
    },
  ],
  workoutSessions: [
    {
      workoutSession: { type: Schema.Types.ObjectId, ref: "workoutSession" },
    },
  ],
});

export default model<userDocument>("User", userSchema);
