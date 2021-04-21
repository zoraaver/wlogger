import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";
import { validateId } from "../middleware/middleware";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);
workoutPlanRoutes.patch("/start/:id", validateId, workoutPlansController.start);
workoutPlanRoutes.patch("/:id", validateId, workoutPlansController.update);
workoutPlanRoutes.put("/:id", validateId, workoutPlansController.update);
workoutPlanRoutes.delete("/:id", validateId, workoutPlansController.destroy);
workoutPlanRoutes.get("/nextWorkout", workoutPlansController.nextWorkout);
workoutPlanRoutes.get("/current", workoutPlansController.current);
workoutPlanRoutes.get("/:id", validateId, workoutPlansController.show);
workoutPlanRoutes.get("/", workoutPlansController.index);
