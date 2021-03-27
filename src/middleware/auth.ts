import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export function setCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader: string | undefined =
    req.get("Authorization") || req.get("Authorisation");
  if (!authHeader) {
    req.currentUserId = undefined;
    next();
  } else {
    try {
      req.currentUserId = Number(
        jwt.verify(authHeader, process.env.JWT_SECRET as string)
      );
      next();
    } catch (error) {
      next();
    }
  }
}

export function loggedIn(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.currentUserId) {
    res
      .status(401)
      .json({ message: "You need to be logged in to see this page." });
  } else {
    next();
  }
  return;
}
