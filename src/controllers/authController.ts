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
    "email password token googleId"
  );
  // if the user has already signed up via google
  if (user?.googleId) {
    res.status(403).json({ message: "Please sign in with google" });
    return;
  }
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
  const { idToken } = req.body;
  try {
    // verify token and find user from google
    const { googleId, email } = await verifyGoogleIdToken(idToken);
    // first try to find user in db by their google id
    let user: userDocument | null = await User.findOne(
      { googleId },
      "email token"
    );
    if (user) {
      res.json({ user: { email: user.email, token: user.token } });
      return;
    }
    // then look for a matching email (i.e. user has signed up previously via email and password)
    user = await User.findOne({ email }, "email token");
    if (user) {
      await user.updateOne({ googleId });
      res.json({ user: { email: user.email, token: user.token } });
      return;
    }
    // otherwise create a new user in db
    user = new User({ email, googleId });
    await user.save();
    res.status(201).json({ user: { email: user.email, token: user.token } });
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
}

async function verifyGoogleIdToken(
  idToken: string
): Promise<{ email: string; googleId: string }> {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const ticket: LoginTicket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload: TokenPayload | undefined = ticket.getPayload();
  if (!payload || payload.aud != process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Authentication failed: aud does not match client id");
  }
  // the email is included in the scope so it will be in the returned payload
  return { email: payload.email as string, googleId: payload.sub };
}
