import express, { Router } from "express";
import * as authController from "../controllers/authController";
import { setCurrentUser } from "../middleware/auth";

export const authRoutes: Router = express.Router();

authRoutes.post("/login", authController.login);
authRoutes.post("/google", authController.googleLogin);
authRoutes.get("/validate", setCurrentUser, authController.validate);
authRoutes.post("/verify", authController.verify);
