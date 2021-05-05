import { MONGO_DB_NAME, MONGO_DB_PASSWORD, MONGO_DB_USER } from "./env";

export const MONGO_DEVELOPMENT_URI: string = `mongodb://localhost:27017/${MONGO_DB_NAME}`;
export const MONGO_TEST_URI: string = MONGO_DEVELOPMENT_URI + "_test";
export const MONGO_PRODUCTION_URI: string = `mongodb+srv://${MONGO_DB_USER}:${MONGO_DB_PASSWORD}@wlogger-cluster.edzuw.mongodb.net/${MONGO_DB_NAME}?retryWrites=true&w=majority`;
