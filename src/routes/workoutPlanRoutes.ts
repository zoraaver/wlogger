import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";
import { validateId } from "../middleware/middleware";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);
workoutPlanRoutes.get("/", workoutPlansController.index);
workoutPlanRoutes.get("/:id", validateId, workoutPlansController.show);
workoutPlanRoutes.patch("/:id", validateId, workoutPlansController.update);
workoutPlanRoutes.put("/:id", validateId, workoutPlansController.update);
workoutPlanRoutes.delete("/:id", validateId, workoutPlansController.destroy);
