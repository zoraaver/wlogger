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
  status: workoutPlanStatus;
  weeks: Array<Week>;
}

const workoutPlanSchema = new Schema<workoutPlanDocument>({
  name: { type: String, required: [true, "Name is a required field"] },
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

export const WorkoutPlan = model<workoutPlanDocument>(
  "WorkoutPlan",
  workoutPlanSchema
);
