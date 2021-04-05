import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);
