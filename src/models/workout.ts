import { Document, Schema } from "mongoose";

type Day =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type weightUnit = "kg" | "lb";

const days: Day[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface workoutDocument extends Document {
  dayOfWeek: Day;
  repeat: number;
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
  repeat: { type: Number, default: 0 },
  dayOfWeek: { type: String, enum: days },
  exercises: [
    {
      name: String,
      restInterval: Number,
      sets: Number,
      repetitions: Number,
      weight: Number,
      unit: { type: String, enum: ["kg", "lb"] },
      autoIncrement: Boolean,
    },
  ],
});
