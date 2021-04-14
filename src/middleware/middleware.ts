import { Request, Response, NextFunction } from "express";
import { isValidObjectId } from "mongoose";

export function validateId(
  req: Request<{ id?: string }>,
  res: Response,
  next: NextFunction
) {
  const { id } = req.params;
  if (!id || !isValidObjectId(id)) {
    res.status(406).json({ message: `${id} is an invalid id` });
    return;
  }
  next();
}
