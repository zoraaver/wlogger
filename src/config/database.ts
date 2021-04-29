import {
  MONGO_DB_USER,
  MONGO_DB_NAME,
  MONGO_DB_PASSWORD,
} from "../../keys.json";

const MONGO_DB_CREDENTIALS: string =
  MONGO_DB_USER === "" ? "" : `${MONGO_DB_USER}:${MONGO_DB_PASSWORD}@`;

export const MONGO_URI: string = `mongodb://${MONGO_DB_CREDENTIALS}localhost:27017/${MONGO_DB_NAME}`;
export const MONGO_TEST_URI: string = MONGO_URI + "_test";
