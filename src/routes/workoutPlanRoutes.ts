import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";
import { validateWorkoutPlanId } from "../middleware/workoutPlan";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);
workoutPlanRoutes.get("/", workoutPlansController.index);
workoutPlanRoutes.get(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.show
);
workoutPlanRoutes.patch(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.update
);
workoutPlanRoutes.put(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.update
);
workoutPlanRoutes.delete(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.destroy
);
