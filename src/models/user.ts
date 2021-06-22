import { Schema, model, Document } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import {
  JWT_SECRET,
  JWT_EMAIL_VERIFICATION_SECRET,
  CLIENT_URL,
  VERIFICATION_EMAIL_TEMPLATE_ID,
  SENDGRID_KEY,
} from "../config/env";
import { workoutPlanDocument, workoutPlanStatus } from "./workoutPlan";
import { workoutLogDocument } from "./workoutLog";
import sgMail from "@sendgrid/mail";
import { exerciseDocument } from "./exercise";

sgMail.setApiKey(SENDGRID_KEY);

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
  exercises: Array<exerciseDocument["_id"]>;
  authenticate: (password: string) => Promise<boolean>;
  getVerificationToken: () => string;
  sendVerificationEmail: () => Promise<void>;
  startWorkoutPlan: (workoutPlanId: string) => Promise<void>;
  token?: string;
  currentWorkoutPlan?: workoutPlanDocument["_id"];
}

const userSchema = new Schema<userDocument>(
  {
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
    exercises: [{ type: Schema.Types.ObjectId, ref: "Exercise" }],
  },
  { timestamps: true }
);

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

userSchema.methods.sendVerificationEmail = async function (): Promise<void> {
  const token = this.getVerificationToken();
  const verifyLink: string = `${CLIENT_URL}/verify/${token}`;

  try {
    await sgMail.send({
      from: { email: "app@wlogger.uk", name: "wLogger" },
      to: this.email,
      dynamicTemplateData: { verifyLink },
      templateId: VERIFICATION_EMAIL_TEMPLATE_ID,
    });
  } catch (error) {
    console.error(error);
  }
};

userSchema.methods.startWorkoutPlan = async function (
  workoutPlanId: string
): Promise<void> {
  await this.populate({
    path: "workoutPlans",
    match: { _id: { $eq: workoutPlanId } },
    select: "_id weeks.repeat",
  })
    .populate("currentWorkoutPlan")
    .execPopulate();

  if (!this.currentWorkoutPlan) this.currentWorkoutPlan = this.workoutPlans[0];

  const previousWorkoutPlan: workoutPlanDocument = this.currentWorkoutPlan;
  previousWorkoutPlan.status = "Not started";

  await previousWorkoutPlan.save();

  this.currentWorkoutPlan = this.workoutPlans[0];
  this.currentWorkoutPlan.status = "In progress" as workoutPlanStatus;
  this.currentWorkoutPlan.start = Date.now();

  await Promise.all([
    this.currentWorkoutPlan.save(),
    this.updateOne({ currentWorkoutPlan: this.currentWorkoutPlan }),
  ]);
};

export const User = model<userDocument>("User", userSchema);
