import { Request, Response, NextFunction } from "express";

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  res.status(201).json({ message: "stuff" });
}
