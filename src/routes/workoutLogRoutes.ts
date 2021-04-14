import { Router } from "express";
import * as workoutLogsController from "../controllers/workoutLogsController";
import { validateId } from "../middleware/middleware";

export const workoutLogRoutes: Router = Router();

workoutLogRoutes.post("/", workoutLogsController.create);
workoutLogRoutes.get("/:id", validateId, workoutLogsController.show);
workoutLogRoutes.get("/", workoutLogsController.index);
workoutLogRoutes.delete("/:id", validateId, workoutLogsController.destroy);
