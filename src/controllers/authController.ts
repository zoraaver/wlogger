import { Request, Response, NextFunction } from "express";

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  res.json(null);
}
