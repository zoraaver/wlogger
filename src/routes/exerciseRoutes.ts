import { Router } from "express";
import * as exercisesController from "../controllers/exercisesController";

export const exerciseRoutes: Router = Router();

exerciseRoutes.get("/", exercisesController.index);
exerciseRoutes.post("/", exercisesController.create);
