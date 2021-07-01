import { Router } from "express";
import * as exercisesController from "../controllers/exercisesController";
import { validateExerciseId } from "../middleware/exercise";

export const exerciseRoutes: Router = Router();

exerciseRoutes.get("/", exercisesController.index);
exerciseRoutes.post("/", exercisesController.create);
exerciseRoutes.delete("/:id", validateExerciseId, exercisesController.destroy);
exerciseRoutes.patch("/:id", validateExerciseId, exercisesController.update);
