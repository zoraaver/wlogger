import { Document, model, Schema } from "mongoose";

export interface workoutSessionDocument extends Document {
  date: Date;
  exercises: Array<{
    name: string;
    sets: number;
    reps: number;
    weight: number;
    restInterval: number;
  }>;
}

const workoutSessionSchema = new Schema<workoutSessionDocument>({
  date: { type: Date, required: true },
  exercises: [
    {
      name: String,
      sets: Number,
      reps: Number,
      weight: Number,
      restInterval: Number,
    },
  ],
});

export default model<workoutSessionDocument>(
  "WorkoutSession",
  workoutSessionSchema
);
