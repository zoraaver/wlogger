import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";
import {
  updateCurrentPlanAsCompletedIfNecessary,
  validateWorkoutPlanId,
} from "../middleware/workoutPlan";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);

workoutPlanRoutes.patch(
  "/start/:id",
  validateWorkoutPlanId,
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.start
);

workoutPlanRoutes.patch(
  "/:id",
  validateWorkoutPlanId,
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.update
);

workoutPlanRoutes.put(
  "/:id",
  validateWorkoutPlanId,
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.update
);

workoutPlanRoutes.delete(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.destroy
);

workoutPlanRoutes.get(
  "/nextWorkout",
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.nextWorkout
);

workoutPlanRoutes.get(
  "/current",
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.current
);

workoutPlanRoutes.get(
  "/:id",
  validateWorkoutPlanId,
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.show
);

workoutPlanRoutes.get(
  "/",
  updateCurrentPlanAsCompletedIfNecessary,
  workoutPlansController.index
);
