import { Request } from "express";
import { User, userDocument } from "../src/models/user";
declare global {
  namespace Express {
    interface Request {
      currentUser: userDocument | null;
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
