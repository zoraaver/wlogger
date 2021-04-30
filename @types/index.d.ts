import { Request } from "express";
import { User, userDocument } from "../src/models/user";
import { workoutLogDocument } from "../src/models/workoutLog";
declare global {
  namespace Express {
    interface Request {
      currentUser: userDocument | null;
      currentWorkoutLog: workoutLogDocument | null;
    }
  }
}

interface ResponseError {
  field: string;
  error: string;
}

interface ResponseMessage {
  message: string;
}
