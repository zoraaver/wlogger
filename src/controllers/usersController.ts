import { Request, Response } from "express";
import { userDocument, User } from "../models/user";

export async function create(req: Request, res: Response): Promise<void> {
  const { email, password, confirmPassword } = req.body;

  try {
    let user: userDocument | null = await User.findOne({
      email: email?.toLowerCase(),
    });

    if (user) {
      throw new Error(
        "Email validation error: email: Email has already been taken"
      );
    }

    if (password != confirmPassword) {
      throw new Error(
        "User validation error: confirmPassword: Confirm password does not match password"
      );
    }

    user = new User({ email, password });
    await user.save();

    user.sendVerificationEmail();

    res.status(201).json({ user: { email: user.email } });
  } catch (error) {
    const errorMessage: string = error.message.split(": ")[2];
    const field: string = error.message.split(": ")[1];

    res.status(406).json({ field, error: errorMessage });
  }
}
