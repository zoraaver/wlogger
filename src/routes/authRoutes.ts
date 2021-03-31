import express, { Router } from "express";
import * as authController from "../controllers/authController";
import { setCurrentUser } from "../middleware/auth";

export const authRoutes: Router = express.Router();

authRoutes.post("/login", authController.login);
authRoutes.post("/google", authController.googleLogin);
authRoutes.post("/validate", setCurrentUser, authController.validate);
