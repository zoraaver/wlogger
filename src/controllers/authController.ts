import { Request, Response, NextFunction } from "express";
import User, { userDocument } from "../models/user";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

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

export async function googleLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const url = oauth2client.generateAuthUrl({
    access_type: "online",
    scope: "email",
  });
  res.json({ url });
}
const oauth2client = new google.auth.OAuth2({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `http://localhost:${process.env.PORT || 8080}`,
});
