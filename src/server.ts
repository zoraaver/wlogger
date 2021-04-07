import { app } from "./app";
import { MONGO_URI } from "./util/database";
import mongoose from "mongoose";

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: true,
  })
  .then(() => {
    console.log("Connected to database successfully");
    app.listen(process.env.PORT || 8080);
    console.log(`Listening on port ${process.env.PORT || 8080}`);
  })
  .catch(console.error);
