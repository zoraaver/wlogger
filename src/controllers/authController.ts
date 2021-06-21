import { Request, Response } from "express";
import { userDocument, User } from "../models/user";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import {
  APPLE_IOS_CLIENT_ID,
  APPLE_WEB_CLIENT_ID,
  GOOGLE_CLIENT_ID,
  JWT_EMAIL_VERIFICATION_SECRET,
} from "../config/env";
import appleSignIn from "apple-signin-auth";
import jwt from "jsonwebtoken";

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const user: userDocument | null = await User.findOne(
    { email: email?.toLowerCase() },
    "email password googleId appleId confirmed"
  );

  if (user?.googleId) {
    res.status(403).json({ message: "Please sign in with Google" });
  } else if (user?.appleId) {
    res.status(403).json({ message: "Please sign in with Apple" });
  } else if (!user || !(await user.authenticate(password))) {
    res.status(401).json({ message: "Invalid email or password" });
  } else if (!user.confirmed) {
    res
      .status(401)
      .json({ message: "Please verify your email address to login" });
  } else {
    setCookieToken(res, user.token as string);
    res.json({ user: { email: user.email } });
  }
}

export async function validate(req: Request, res: Response): Promise<void> {
  if (req.currentUser) {
    const user = req.currentUser;
    setCookieToken(res, user.token as string);
    res.json({ user: { email: user.email } });
  } else {
    res
      .status(401)
      .json({ message: "This page requires you to be logged in." });
  }
}

export async function googleLogin(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body;
  try {
    const { googleId, email } = await verifyGoogleIdToken(idToken);

    let user: userDocument | null = await User.findOne({ googleId }, "email");
    let userCreated: 0 | 1 = 0;

    if (!user) {
      user = await User.findOne({ email }, "email password appleId");

      if (user && user.appleId) {
        res.status(403).json({ message: "Please sign in with Apple" });
        return;
      } else if (user) {
        user.googleId = googleId;
        user.confirmed = true;
        await user.save();
      } else {
        userCreated = 1;
        user = await User.create({ email, googleId, confirmed: true });
      }
    }

    setCookieToken(res, user.token as string);
    res.status(200 + userCreated).json({ user: { email: user.email } });
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

async function verifyGoogleIdToken(
  idToken: string
): Promise<{ email: string; googleId: string }> {
  const payload: TokenPayload | undefined = (
    await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    })
  ).getPayload();

  if (!payload || payload.aud != GOOGLE_CLIENT_ID) {
    throw new Error("Authentication failed: aud does not match client id");
  }

  return { email: payload.email as string, googleId: payload.sub };
}

export async function appleLogin(
  req: Request<any, any, { idToken: string }>,
  res: Response
): Promise<void> {
  const { idToken } = req.body;
  try {
    const { email, sub: appleId } = await appleSignIn.verifyIdToken(idToken, {
      audience: [APPLE_IOS_CLIENT_ID, APPLE_WEB_CLIENT_ID],
      issuer: "https://appleid.apple.com",
    });

    let user = await User.findOne({ appleId }, "email");
    let userCreated: 0 | 1 = 0;

    if (!user) {
      user = await User.findOne({ email }, "email password googleId");

      if (user && user.googleId) {
        res.status(403).json({ message: "Please sign in with Google" });
        return;
      } else if (user) {
        user.appleId = appleId;
        user.confirmed = true;
        await user.save();
      } else {
        user = await User.create({ email, appleId, confirmed: true });
        userCreated = 1;
      }
    }

    setCookieToken(res, user.token as string);
    res.status(200 + userCreated).json({ user: { email: user.email } });
  } catch (error) {
    res.status(401).json({ message: "Authentication failed" });
  }
}

export async function verify(req: Request, res: Response): Promise<void> {
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

    setCookieToken(res, user.token as string);
    res.json({ user: { email: user.email } });
  } catch (error) {
    res.status(406).json({ message: "Invalid verification token" });
    return;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie("token");
  res.json();
}

function setCookieToken(res: Response, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
}
