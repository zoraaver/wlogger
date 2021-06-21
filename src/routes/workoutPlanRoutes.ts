import { Router } from "express";
import * as workoutPlansController from "../controllers/workoutPlansController";
import {
  updateCurrentPlanAsCompletedIfNecessary,
  validateWorkoutPlanId,
} from "../middleware/workoutPlan";

export const workoutPlanRoutes: Router = Router();

workoutPlanRoutes.post("/", workoutPlansController.create);

workoutPlanRoutes.delete(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.destroy
);

workoutPlanRoutes.use(updateCurrentPlanAsCompletedIfNecessary);

workoutPlanRoutes.patch(
  "/start/:id",
  validateWorkoutPlanId,
  workoutPlansController.start
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

workoutPlanRoutes.get("/nextWorkout", workoutPlansController.nextWorkout);

workoutPlanRoutes.get("/current", workoutPlansController.current);

workoutPlanRoutes.get(
  "/:id",
  validateWorkoutPlanId,
  workoutPlansController.show
);

workoutPlanRoutes.get("/", workoutPlansController.index);
