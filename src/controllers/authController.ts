import { Request, Response, NextFunction } from "express";
import User, { userDocument } from "../models/user";
import { LoginTicket, OAuth2Client, TokenPayload } from "google-auth-library";
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
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const { token } = req.body;
  const ticket: LoginTicket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload: TokenPayload | undefined = ticket.getPayload();
  console.log(payload);
  res.redirect("http://localhost:3000");
}
