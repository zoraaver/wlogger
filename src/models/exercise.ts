import { Document, model, Schema } from "mongoose";

export interface exerciseDocument extends Document {
  name: string;
  category: string[];
}

const exerciseSchema = new Schema<exerciseDocument>({
  name: { type: String, required: true },
  categories: [String],
});

export default model<exerciseDocument>("Exercise", exerciseSchema);
