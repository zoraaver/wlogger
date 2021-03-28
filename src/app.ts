import express, { Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import { authRoutes } from "./routes/authRoutes";
import { userRoutes } from "./routes/userRoutes";

export const app: Application = express();

// parse incoming requests as JSON
app.use(express.json());

// security
app.use(helmet());

if (process.env.NODE_ENV !== "production") {
  // logging
  app.use(morgan("dev"));
  // disable all cors errors
  app.use(cors());
}

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
