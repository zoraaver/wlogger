import { Request, Response, NextFunction } from "express";
import sgMail from "@sendgrid/mail";
import {
  SENDGRID_KEY,
  CLIENT_URL,
  VERIFICATION_EMAIL_TEMPLATE_ID,
} from "../../keys.json";
import User, { userDocument } from "../models/user";

sgMail.setApiKey(SENDGRID_KEY);

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
    sendVerificationEmail(email, user.getVerificationToken());
  } catch (error) {
    const errorMessage: string = error.message.split(": ")[2];
    res.status(406).json({ message: errorMessage });
    return;
  }
  res
    .status(201)
    .json({ user: { email: user.email, workoutPlans: user.workoutPlans } });
}

async function sendVerificationEmail(email: string, token: string) {
  const verifyLink: string = `${CLIENT_URL}/confirm/${token}`;
  try {
    await sgMail.send({
      from: { email: "app@wlogger.uk", name: "wLogger" },
      to: email,
      dynamicTemplateData: { verifyLink },
      templateId: VERIFICATION_EMAIL_TEMPLATE_ID,
    });
  } catch (error) {
    console.error(error);
  }
}
