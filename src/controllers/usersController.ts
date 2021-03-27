import { Request, Response, NextFunction } from "express";
import User, { userDocument } from "../models/user";

export async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    res
      .status(406)
      .json({ message: "Password and confirm password do not match" });
    return;
  }

  let user: userDocument | null = await User.findOne({ email });
  if (user) {
    res.status(406).json({ message: "Email has already been taken" });
    return;
  }

  user = new User({ email, password });

  try {
    await user.save();
  } catch (error) {
    const errorMessage: string = error.message.split(": ")[2];
    res.status(406).json({ message: errorMessage });
    return;
  }
  res
    .status(201)
    .json({ user: { email: user.email, workoutPlans: user.workoutPlans } });
}
