import { Router } from "express";
import * as usersController from "../controllers/usersController";

export const userRoutes: Router = Router();

userRoutes.post("/", usersController.create);
