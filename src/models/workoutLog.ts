import { ObjectID } from "bson";
import { Document, model, Schema } from "mongoose";
import { S3 } from "../config/aws";
import { weightUnit, workoutDocument } from "./workout";
import { WLOGGER_BUCKET } from "../config/env";
import { PresignedPost } from "aws-sdk/clients/s3";
import { megaByte } from "../util/util";

export type workoutLog = {
  createdAt: Date;
  updatedAt: Date;
  workoutId: workoutDocument["_id"];
  exercises: Array<loggedExerciseDocument>;
  calculateSetNumber: () => number;
  generateWorkoutLogHeaderData: () => workoutLogHeaderData;
  deleteSetVideo: (
    exerciseId: string,
    setId: string,
    userId: string
  ) => Promise<boolean>;
  deleteAllSetVideos: (userId: string) => Promise<void>;
  findSet: (exercseId: string, setId: string) => loggedSet | undefined;
  generateSetVideoDisplayFileName: (
    exerciseId: string,
    setId: string
  ) => string | undefined;
  getVideoFileSize: (
    userId?: string,
    exerciseId?: string,
    set?: loggedSetDocument
  ) => Promise<number>;
  generateSignedUrls: (userId: string) => PresignedPost[];
};

export type workoutLogDocument = Document & workoutLog;

export type videoFileExtension = "mov" | "avi" | "mp4";
export const validFileExtensions: videoFileExtension[] = ["avi", "mov", "mp4"];

export interface workoutLogHeaderData {
  createdAt: Date;
  setCount: number;
  exerciseCount: number;
  _id: string;
}

type loggedExercise = {
  name: string;
  exerciseId?: ObjectID;
  sets: Array<loggedSetDocument>;
};

export type loggedExerciseDocument = loggedExercise & Document;

export type loggedSet = {
  weight: number;
  formVideoExtension?: videoFileExtension;
  unit: weightUnit;
  repetitions: number;
  restInterval: number;
};

export type loggedSetDocument = loggedSet & Document;

const weightUnits: weightUnit[] = ["kg", "lb"];

const workoutLogSchema = new Schema<workoutLogDocument>({
  workoutId: { type: Schema.Types.ObjectId, ref: "Workout" },
  exercises: [
    {
      name: { type: String, required: [true, "Name is a required field"] },
      exerciseId: { type: Schema.Types.ObjectId },
      sets: [
        {
          weight: { type: Number, default: 0 },
          restInterval: { type: Number, default: 0 },
          unit: {
            type: String,
            required: [true, "Unit is a required field"],
            enum: {
              values: weightUnits,
              message: "Unit must be one of 'kg' or 'lb'",
            },
          },
          repetitions: { type: Number, default: 0 },
          formVideoExtension: {
            type: String,
            enum: {
              values: validFileExtensions,
              message: "Valid extensions are 'mov', 'mp4' and 'avi'",
            },
          },
        },
      ],
    },
  ],
  createdAt: {
    type: Date,
    default: new Date(),
    validate: {
      validator: (date: Date) => date <= new Date(),
      message: (value: string) => "createdAt Date cannot be in the future",
    },
  },
});

workoutLogSchema.methods.generateWorkoutLogHeaderData =
  function (): workoutLogHeaderData {
    return {
      createdAt: this.createdAt,
      setCount: this.calculateSetNumber(),
      exerciseCount: this.exercises.length,
      _id: this._id,
    };
  };

workoutLogSchema.methods.deleteSetVideo = async function (
  exerciseId: string,
  setId: string,
  userId: string
): Promise<boolean> {
  const set: loggedSet | undefined = this.findSet(exerciseId, setId);
  if (!set || !set.formVideoExtension) return false;
  const videoKey = `${userId}/${this.id}/${exerciseId}.${setId}.${set.formVideoExtension}`;
  const result = await S3.deleteObject({
    Bucket: WLOGGER_BUCKET,
    Key: videoKey,
  }).promise();
  if (!result.$response.error) {
    set.formVideoExtension = undefined;
    await this.save();
  }
  return true;
};

workoutLogSchema.methods.findSet = function (
  exerciseId: string,
  setId: string
): loggedSet | undefined {
  return this.exercises
    .find((exercise) => exercise.id === exerciseId)
    ?.sets.find((set) => set.id === setId);
};

workoutLogSchema.methods.calculateSetNumber = function (): number {
  return this.exercises.reduce(
    (total: number, curr: loggedExercise) => total + curr.sets.length,
    0
  );
};

workoutLogSchema.methods.deleteAllSetVideos = async function (
  userId: string
): Promise<void> {
  const videoObjectsToDelete: { Key: string }[] = [];
  for (const exercise of this.exercises) {
    for (const set of exercise.sets) {
      if (!set.formVideoExtension) continue;
      const videoKey: string = `${userId}/${this.id}/${exercise.id}.${set.id}.${set.formVideoExtension}`;
      videoObjectsToDelete.push({ Key: videoKey });
    }
  }
  if (videoObjectsToDelete.length > 0) {
    await S3.deleteObjects({
      Bucket: WLOGGER_BUCKET,
      Delete: { Quiet: true, Objects: videoObjectsToDelete },
    }).promise();
  }
};

workoutLogSchema.methods.generateSetVideoDisplayFileName = function (
  exerciseId: string,
  setId: string
) {
  const exercise: loggedExerciseDocument | undefined = this.exercises.find(
    (exercise) => exercise.id === exerciseId
  );
  const set: loggedSet | undefined = exercise?.sets.find(
    (set) => set.id === setId
  );
  return `${this.createdAt.toDateString()}: ${exercise?.name}, ${
    set?.repetitions
  } x ${set?.weight} ${set?.unit}.${set?.formVideoExtension}`;
};

workoutLogSchema.methods.getVideoFileSize = async function (
  userId?: string,
  exerciseId?: string,
  set?: loggedSetDocument
): Promise<number> {
  if (!set || !userId || !exerciseId) return 0;
  const videoKey: string = `${userId}/${this.id}/${exerciseId}.${set.id}`;
  const result = await S3.listObjectsV2({
    Bucket: WLOGGER_BUCKET,
    Prefix: videoKey,
  }).promise();
  if (result.$response.data) {
    const fileSize: number | undefined =
      result.$response.data.Contents?.[0]?.Size;
    return fileSize === undefined ? 0 : fileSize;
  }
  return 0;
};

workoutLogSchema.methods.generateSignedUrls = function (
  userId: string
): PresignedPost[] {
  const preSignedPosts: PresignedPost[] = [];
  const videoLimit: number = 5;

  for (const exercise of this.exercises) {
    let videoLimitReached: boolean = false;
    for (const set of exercise.sets) {
      if (!set.formVideoExtension) continue;
      const videoKey: string = `${userId}/${this.id}/${exercise.id}.${set.id}.${set.formVideoExtension}`;
      const preSignedPost: PresignedPost = createSignedPostForWorkoutLogVideo(
        videoKey,
        50 * megaByte
      );
      preSignedPosts.push(preSignedPost);
      if (preSignedPosts.length >= videoLimit) {
        videoLimitReached = true;
        break;
      }
    }
    if (videoLimitReached) break;
  }
  return preSignedPosts;
};

function createSignedPostForWorkoutLogVideo(
  key: string,
  fileSizeLimit: number
): PresignedPost {
  return S3.createPresignedPost({
    Bucket: WLOGGER_BUCKET,
    Expires: 600,
    Conditions: [
      ["starts-with", "$Content-Type", "video/"],
      ["content-length-range", 0, fileSizeLimit],
    ],
    Fields: { key },
  });
}

export const WorkoutLog = model<workoutLogDocument>(
  "WorkoutLog",
  workoutLogSchema
);
