import { Request, Response, NextFunction } from "express";
import { userDocument, User } from "../models/user";
import { LoginTicket, OAuth2Client, TokenPayload } from "google-auth-library";
import {
  GOOGLE_CLIENT_ID,
  JWT_EMAIL_VERIFICATION_SECRET,
} from "../../keys.json";
import jwt from "jsonwebtoken";

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { email, password } = req.body;

  const user: userDocument | null = await User.findOne(
    { email },
    "email password googleId confirmed"
  );
  // if the user has already signed up via google
  if (user?.googleId) {
    res.status(403).json({ message: "Please sign in with Google" });
    return;
  }
  if (!user || !(await user.authenticate(password))) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  if (!user.confirmed) {
    res
      .status(401)
      .json({ message: "Please verify your email address to login" });
    return;
  }
  res.json({ user: { email: user.email, token: user.token } });
}

export async function validate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.currentUserId) {
    let user;
    try {
      user = await User.findById(req.currentUserId, "email");
    } catch (error) {
      res
        .status(401)
        .json({ message: "This page requires you to be logged in." });
      return;
    }
    if (!user) {
      res.status(404).json({ message: "User cannot be found." });
      return;
    }
    res.json({ user: { email: user.email, token: user.token } });
  } else {
    res
      .status(401)
      .json({ message: "This page requires you to be logged in." });
  }
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
    let user: userDocument | null = await User.findOne({ googleId }, "email");
    if (user) {
      res.json({ user: { email: user.email, token: user.token } });
      return;
    }
    // then look for a matching email (i.e. user has signed up previously via email and password)
    user = await User.findOne({ email }, "email password");
    if (user) {
      user.googleId = googleId;
      user.confirmed = true;
      await user.save();
      res.json({ user: { email: user.email, token: user.token } });
      return;
    }
    // otherwise create a new user in db
    user = new User({ email, googleId, confirmed: true });
    await user.save();
    res.status(201).json({ user: { email: user.email, token: user.token } });
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
}

async function verifyGoogleIdToken(
  idToken: string
): Promise<{ email: string; googleId: string }> {
  const client = new OAuth2Client(GOOGLE_CLIENT_ID);
  const ticket: LoginTicket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload: TokenPayload | undefined = ticket.getPayload();
  if (!payload || payload.aud != GOOGLE_CLIENT_ID) {
    throw new Error("Authentication failed: aud does not match client id");
  }
  // the email is included in the scope so it will be in the returned payload
  return { email: payload.email as string, googleId: payload.sub };
}

export async function verify(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { verificationToken } = req.body;
  try {
    const { userId } = jwt.verify(
      verificationToken,
      JWT_EMAIL_VERIFICATION_SECRET
    ) as any;

    const user: userDocument | null = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: `Cannot find user with id ${userId}` });
      return;
    }
    user.confirmed = true;
    await user.save();
    res.json({ user: { email: user.email, token: user.token } });
  } catch (error) {
    res.status(406).json({ message: "Invalid verification token" });
    return;
  }
}
