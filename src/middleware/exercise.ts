import { NextFunction } from "express";
import { ObjectID } from "mongodb";
import { isValidObjectId } from "mongoose";
import { ResponseMessage } from "../../@types";
import { Request, Response } from "express";

export function validateExerciseId(
  req: Request<{ id?: string }>,
  res: Response<ResponseMessage>,
  next: NextFunction
) {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    res.status(406).json({ message: `${id} is an invalid id` });
    return;
  } else if (!req.currentUser?.exercises.includes(new ObjectID(id), 0)) {
    res.status(404).json({ message: `Cannot find exercise with id ${id}` });
    return;
  }
  next();
}
