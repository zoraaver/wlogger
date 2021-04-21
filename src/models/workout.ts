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
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const weightUnits: weightUnit[] = ["kg", "lb"];

export const daysToNumbers: { [dayOfWeek: string]: number } = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

export interface workoutDocument extends Document {
  dayOfWeek: Day;
  calculateDate: (weeksIntoFuture: number) => Date;
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

workoutSchema.methods.calculateDate = function (weeksIntoFuture: number): Date {
  const today: Day = days[new Date(Date.now()).getDay()];
  const millisecondsInDay: number = 1000 * 60 * 60 * 24;
  const millisecondsInWeek: number = 7 * millisecondsInDay;
  const daysIntoFuture: number =
    daysToNumbers[this.dayOfWeek] - daysToNumbers[today];
  return new Date(
    Date.now() +
      weeksIntoFuture * millisecondsInWeek +
      daysIntoFuture * millisecondsInDay
  );
};
