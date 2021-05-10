// get env variables from .env file in development or testing
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

export const MONGO_DB_NAME = process.env.MONGO_DB_NAME as string;
export const MONGO_DB_USER = process.env.MONGO_DB_USER as string;
export const MONGO_DB_PASSWORD = process.env.MONGO_DB_PASSWORD as string;
export const WLOGGER_BUCKET = process.env.WLOGGER_BUCKET as string;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const JWT_EMAIL_VERIFICATION_SECRET = process.env
  .JWT_EMAIL_VERIFICATION_SECRET as string;
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;
export const SENDGRID_KEY = process.env.SENDGRID_KEY as string;
const CLIENT_PRODUCTION_URL = process.env.CLIENT_PRODUCTION_URL as string;
const CLIENT_DEVELOPMENT_URL = process.env.CLIENT_DEVELOPMENT_URL as string;
export const CLIENT_URL =
  process.env.NODE_ENV === "production"
    ? CLIENT_PRODUCTION_URL
    : CLIENT_DEVELOPMENT_URL;
export const VERIFICATION_EMAIL_TEMPLATE_ID = process.env
  .VERIFICATION_EMAIL_TEMPLATE_ID as string;
export const region = process.env.region as string;
export const secretAccessKey = process.env.secretAccessKey as string;
export const accessKeyId = process.env.accessKeyId as string;
