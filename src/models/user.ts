import { Schema, model, Document } from "mongoose";
import validator from "validator";
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
  email: {
    type: String,
    required: [true, "Email is a required field"],
    validate: {
      validator: (email: string) => validator.isEmail(email),
      message: "Email is invalid",
    },
  },
  password: { type: String, required: [true, "Password is required"] },
  age: Number,
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
