import * as AWS from "aws-sdk";
import { region, secretAccessKey, accessKeyId } from "./env";

export const S3: AWS.S3 = new AWS.S3({ region, secretAccessKey, accessKeyId });
