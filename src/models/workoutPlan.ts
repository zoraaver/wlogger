import { Document, Schema, model } from "mongoose";
import { workoutDocument } from "./workout";
import { workoutSchema } from "./workout";

export type workoutPlanStatus = "In progress" | "Completed" | "Not started";
const workoutPlanStatuses: workoutPlanStatus[] = [
  "Completed",
  "In progress",
  "Not started",
];

export interface Week {
  position: number;
  workouts: Array<workoutDocument>;
  repeat: number;
}

export interface workoutPlanDocument extends Document {
  name: string;
  start: Date;
  end: Date;
  length: number;
  status: workoutPlanStatus;
  weeks: Array<Week>;
  verifyNumberOfWeeksEqualsLength: () => boolean;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: [true, "Name is a required field"] },
  length: {
    type: Number,
    cast: "Length must be a number",
    default: 0,
    min: [0, "Length must be a non-negative integer"],
  },
  status: {
    type: String,
    enum: {
      values: workoutPlanStatuses,
      message:
        "Status must be one of 'Completed', 'In Progress' or 'Not started'",
    },
    default: "Not started",
  },
  start: Date,
  end: Date,
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

workoutPlanSchema.methods.verifyNumberOfWeeksEqualsLength = function (): boolean {
  const length: number = this.length;
  const actualLength: number = this.weeks.reduce(
    (acc: number, curr: Week) => acc + curr.repeat + 1,
    0
  );
  return length === actualLength;
};

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
