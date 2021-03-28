import express, { Router } from "express";
import * as authController from "../controllers/authController";

export const authRoutes: Router = express.Router();

authRoutes.post("/login", authController.login);
authRoutes.get("/google", authController.googleLogin);
