import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);
workoutPlanRoutes.get("/", workoutPlansController.index);
workoutPlanRoutes.get("/:id", workoutPlansController.show);
workoutPlanRoutes.patch("/:id", workoutPlansController.update);
workoutPlanRoutes.put("/:id", workoutPlansController.update);
workoutPlanRoutes.delete("/:id", workoutPlansController.destroy);
