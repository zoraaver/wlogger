import { Router } from "express";
import * as workoutLogsController from "../controllers/workoutLogsController";

export const workoutLogRoutes: Router = Router();

workoutLogRoutes.post("/", workoutLogsController.create);
workoutLogRoutes.get("/", workoutLogsController.index);
