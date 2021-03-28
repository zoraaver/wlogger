import { Schema, model, Document } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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
  authenticate: (password: string) => Promise<boolean>;
  token?: string;
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

// store hashed passwords in db
userSchema.pre("save", async function (): Promise<void> {
  if (!this.password) throw new Error("Password is required");
  this.password = await bcrypt.hash(this.password, 12);
});

// convenience attribute on User model to get a JWT for the user
userSchema.virtual("token").get(function (this: userDocument): string {
  if (!this._id) throw Error("_id for user has not yet been created");
  const userId: string = this._id.toString();
  return jwt.sign(userId, process.env.JWT_SECRET as string);
});

// check whether a given password matches the hashed db password for the user
userSchema.methods.authenticate = function (
  password: string
): Promise<boolean> {
  if (!this.password) throw new Error("No password found for this user");
  return bcrypt.compare(password, this.password);
};

export default model<userDocument>("User", userSchema);
