import { Router } from "express";
import * as workoutLogsController from "../controllers/workoutLogsController";
import { validateWorkoutLogId } from "../middleware/workoutLog";

export const workoutLogRoutes: Router = Router();

workoutLogRoutes.post("/", workoutLogsController.create);

workoutLogRoutes.get("/:id", validateWorkoutLogId, workoutLogsController.show);

workoutLogRoutes.get("/", workoutLogsController.index);

workoutLogRoutes.delete(
  "/:id",
  validateWorkoutLogId,
  workoutLogsController.destroy
);
