import { Request, Response, NextFunction } from "express";
import User, { userDocument } from "../models/user";

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { email, password } = req.body;

  const user: userDocument | null = await User.findOne(
    { email },
    "email password token"
  );
  if (!user || !(await user.authenticate(password))) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }
  res.json({ user: { email: user.email, token: user.token } });
}
