import { ObjectID } from "bson";
import { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { ResponseMessage } from "../../@types";

export function validateWorkoutLogId(
  req: Request<{ id?: string }>,
  res: Response<ResponseMessage>,
  next: NextFunction
) {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    res.status(406).json({ message: `${id} is an invalid id` });
    return;
  } else if (!req.currentUser?.workoutLogs.includes(new ObjectID(id), 0)) {
    res.status(404).json({ message: `Cannot find workout log with id ${id}` });
    return;
  }
  next();
}
