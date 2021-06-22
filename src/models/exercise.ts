import { Document, model, Schema } from "mongoose";

interface exercise {
  name: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type exerciseDocument = exercise & Document;

const exerciseSchema = new Schema<exerciseDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is a required field"],
      maxLength: [100, "Name must be at most 100 characters"],
    },
    notes: {
      type: String,
      maxLength: [500, "Notes must be at most 500 characters"],
    },
  },
  { timestamps: true }
);

export const Exercise = model<exerciseDocument>("Exercise", exerciseSchema);
