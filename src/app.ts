import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { authRoutes } from "./routes/authRoutes";
import { userRoutes } from "./routes/userRoutes";
import { workoutPlanRoutes } from "./routes/workoutPlanRoutes";
import { loggedIn, setCurrentUser } from "./middleware/auth";
import { workoutLogRoutes } from "./routes/workoutLogRoutes";

export const app: Application = express();

// parse incoming requests as JSON
app.use(express.json());

// security
app.use(helmet());

if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === undefined
) {
  // logging
  app.use(morgan("dev"));
  // disable all cors errors
  app.use(cors());
}

app.use(setCurrentUser);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/workoutPlans", loggedIn, workoutPlanRoutes);
app.use("/workoutLogs", loggedIn, workoutLogRoutes);
