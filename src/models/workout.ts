import { Document, Schema } from "mongoose";
import { exerciseDocument } from "./exercise";

type Day =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface workoutDocument extends Document {
  dayOfWeek?: Day;
  exercises: Array<{
    _id: exerciseDocument["_id"];
    restInterval: number;
    sets: number;
    repetitions: number;
    weight: number;
    autoIncrement: boolean;
  }>;
}

export const workoutSchema = new Schema<workoutDocument>({
  repeat: { type: Boolean, required: true },
  dayOfWeek: String,
  exercises: [
    {
      exerciseId: { type: Schema.Types.ObjectId, ref: "exercise" },
      restInterval: Number,
      sets: Number,
      repetitions: Number,
      weight: Number,
      autoIncrement: Boolean,
    },
  ],
});
