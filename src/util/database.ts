import {
  MONGO_DB_USER,
  MONGO_DB_NAME,
  MONGO_DB_PASSWORD,
} from "../../keys.json";

export const MONGO_URI: string = `mongodb+srv://${MONGO_DB_USER}:${MONGO_DB_PASSWORD}@cluster0.xgkor.mongodb.net/${MONGO_DB_NAME}`;
export const MONGO_TEST_URI: string = MONGO_URI + "_test";
