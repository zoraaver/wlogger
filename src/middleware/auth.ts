import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { JWT_SECRET } from "../config/env";
import { User } from "../models/user";

export async function setCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader: string | undefined =
    req.get("Authorization") ||
    req.get("Authorisation") ||
    req.cookies["token"];
  if (!authHeader) {
    req.currentUser = null;
    next();
  } else {
    try {
      const userId: string = String(jwt.verify(authHeader, JWT_SECRET));
      req.currentUser = await User.findById(userId);
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
  if (!req.currentUser) {
    res
      .status(401)
      .json({ message: "You need to be logged in to see this page." });
  } else {
    next();
  }
  return;
}
