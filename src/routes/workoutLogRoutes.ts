import { Router } from "express";
import {
  S3WorkoutLogVideoUpload,
  setCurrentWorkoutLog,
} from "../middleware/workoutLog";
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

workoutLogRoutes.get(
  "/:id/:exerciseIndex/:setIndex/stream",
  validateWorkoutLogId,
  setCurrentWorkoutLog,
  workoutLogsController.videoDownload
);

workoutLogRoutes.post(
  "/:id/videoUpload",
  validateWorkoutLogId,
  setCurrentWorkoutLog,
  S3WorkoutLogVideoUpload.array("formVideos", 5),
  workoutLogsController.videoUpload
);
