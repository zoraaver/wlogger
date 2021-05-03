import * as AWS from "aws-sdk";
import path from "path";

AWS.config.loadFromPath(path.resolve(__dirname, "..", "..", "keys.json"));
export const S3: AWS.S3 = new AWS.S3();
