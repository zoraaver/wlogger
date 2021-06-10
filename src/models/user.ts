import { Schema, model, Document } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import { JWT_SECRET, JWT_EMAIL_VERIFICATION_SECRET } from "../config/env";
import { workoutPlanDocument } from "./workoutPlan";
import { workoutLogDocument } from "./workoutLog";

export interface userDocument extends Document {
  email: string;
  password?: string;
  age?: number;
  confirmed: boolean;
  weight?: number;
  height?: number;
  googleId?: string;
  appleId?: string;
  workoutPlans: Array<workoutPlanDocument["_id"] | workoutPlanDocument>;
  workoutLogs: Array<workoutLogDocument["_id"]>;
  authenticate: (password: string) => Promise<boolean>;
  getVerificationToken: () => string;
  token?: string;
  currentWorkoutPlan?: workoutPlanDocument["_id"];
}
// TODO: add field 'lastCompletedWorkoutDate' to user

const userSchema = new Schema<userDocument>({
  email: {
    type: String,
    required: [true, "Email is a required field"],
    unique: true,
    validate: {
      validator: (email: string) => validator.isEmail(email),
      message: "Email is invalid",
    },
  },
  password: String,
  age: Number,
  weight: Number,
  height: Number,
  confirmed: { type: Boolean, default: false },
  googleId: String,
  appleId: String,
  currentWorkoutPlan: { type: Schema.Types.ObjectId, ref: "WorkoutPlan" },
  workoutPlans: [{ type: Schema.Types.ObjectId, ref: "WorkoutPlan" }],
  workoutLogs: [{ type: Schema.Types.ObjectId, ref: "WorkoutLog" }],
});

async function hashDbPassword(this: userDocument): Promise<void> {
  if (this.googleId || this.appleId) return;
  if (!this.password)
    throw new Error("User validation failed: password: Password is required");
  if (this.isModified("password"))
    this.password = await bcrypt.hash(this.password, 12);
}

// store hashed passwords in db
userSchema.pre("save", hashDbPassword);

userSchema.pre("save", function () {
  if (this.isModified("email")) {
    this.email = this.email.toLowerCase();
  }
});

// convenience attribute on User model to get a JWT for the user
userSchema.virtual("token").get(function (this: userDocument): string {
  if (!this._id) throw new Error("_id for user has not yet been created");
  const userId: string = this._id.toString();
  return jwt.sign(userId, JWT_SECRET);
});

// generate separate token to verify user's email address
userSchema.methods.getVerificationToken = function (): string {
  if (!this._id) throw new Error("_id for user has not yet been created");
  const userId: string = this._id.toString();
  return jwt.sign({ userId }, JWT_EMAIL_VERIFICATION_SECRET, {
    expiresIn: "1d",
  });
};

// check whether a given password matches the hashed db password for the user
userSchema.methods.authenticate = function (
  password: string
): Promise<boolean> {
  if (!this.password) throw new Error("No password found for this user");
  return bcrypt.compare(password, this.password);
};

export const User = model<userDocument>("User", userSchema);
