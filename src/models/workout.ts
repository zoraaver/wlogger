import { Document, Schema } from "mongoose";

export type Day =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type weightUnit = "kg" | "lb";

export const days: Day[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const weightUnits: weightUnit[] = ["kg", "lb"];

export interface workoutDocument extends Document {
  dayOfWeek: Day;
  exercises: Array<{
    name: string;
    restInterval: number;
    sets: number;
    repetitions: number;
    weight: number;
    unit: weightUnit;
    autoIncrement: boolean;
  }>;
}

export const workoutSchema = new Schema<workoutDocument>({
  dayOfWeek: {
    type: String,
    required: [true, "Day of the week is required"],
    enum: { values: days, message: "Invalid day of week" },
  },
  exercises: [
    {
      name: { type: String, required: [true, "Exercise name is required"] },
      restInterval: Number,
      sets: {
        type: Number,
        required: true,
        min: [1, "Sets must be a positive integer"],
      },
      repetitions: {
        type: Number,
        min: [0, "Repetitions must be a non-negative integer"],
        default: 0,
      },
      weight: {
        type: Number,
        min: [0, "Weight must be a non-negative number"],
        default: 0,
      },
      unit: {
        type: String,
        enum: {
          values: weightUnits,
          message: "Unit must be one of 'kg' or 'lb'",
        },
      },
      autoIncrement: Boolean,
    },
  ],
});
