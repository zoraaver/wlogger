import { app } from "./app";
import { MONGO_DEVELOPMENT_URI, MONGO_PRODUCTION_URI } from "./config/database";
import mongoose from "mongoose";

let MONGO_URI: string = MONGO_DEVELOPMENT_URI;

if (process.env.NODE_ENV === "production") {
  MONGO_URI = MONGO_PRODUCTION_URI;
}

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log("Connected to database successfully");
    app.listen(process.env.PORT || 8080);
    console.log(`Listening on port ${process.env.PORT || 8080}`);
  })
  .catch(console.error);
