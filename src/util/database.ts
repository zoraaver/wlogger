import dotenv from "dotenv";
dotenv.config();

export const MONGO_URI: string = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASSWORD}@cluster0.xgkor.mongodb.net/${process.env.MONGO_DB_NAME}`;
export const MONGO_TEST_URI: string = MONGO_URI + "_test";
