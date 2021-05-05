import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRoutes } from "./routes/authRoutes";
import { userRoutes } from "./routes/userRoutes";
import { workoutPlanRoutes } from "./routes/workoutPlanRoutes";
import { loggedIn, setCurrentUser } from "./middleware/auth";
import { workoutLogRoutes } from "./routes/workoutLogRoutes";
import { CLIENT_PRODUCTION_URL, CLIENT_DEVELOPMENT_URL } from "../keys.json";

export const app: Application = express();

app.use(express.json());
app.use(cookieParser());
app.use(helmet());

switch (process.env.NODE_ENV) {
  case "production":
    app.use(cors({ credentials: true, origin: CLIENT_PRODUCTION_URL }));
    break;
  case "test":
    app.use(cors());
    break;
  case "development":
  default:
    app.use(morgan("dev"));
    app.use(cors({ credentials: true, origin: CLIENT_DEVELOPMENT_URL }));
}

app.use(setCurrentUser);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/workoutPlans", loggedIn, workoutPlanRoutes);
app.use("/workoutLogs", loggedIn, workoutLogRoutes);
