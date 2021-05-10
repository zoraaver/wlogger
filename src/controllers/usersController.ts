import { Request, Response } from "express";
import sgMail from "@sendgrid/mail";
import {
  SENDGRID_KEY,
  CLIENT_URL,
  VERIFICATION_EMAIL_TEMPLATE_ID,
} from "../config/env";
import { userDocument, User } from "../models/user";

sgMail.setApiKey(SENDGRID_KEY);

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
    if (password != confirmPassword)
      throw new Error(
        "User validation error: confirmPassword: Confirm password does not match password"
      );

    user = new User({ email, password });
    await user.save();
    sendVerificationEmail(email, user.getVerificationToken());
    res.status(201).json({ user: { email: user.email } });
  } catch (error) {
    const errorMessage: string = error.message.split(": ")[2];
    const field: string = error.message.split(": ")[1];
    res.status(406).json({ field, error: errorMessage });
    return;
  }
}

async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const verifyLink: string = `${CLIENT_URL}/verify/${token}`;
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
