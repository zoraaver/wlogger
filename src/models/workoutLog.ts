import { ObjectID } from "bson";
import { Document, model, Schema } from "mongoose";
import { S3 } from "../config/aws";
import { weightUnit, workoutDocument } from "./workout";
import { WLOGGER_BUCKET } from "../../keys.json";

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
  sets: Array<loggedSet & Document>;
};

export type loggedExerciseDocument = loggedExercise & Document;

export type loggedSet = {
  weight: number;
  formVideo?: {
    size: number;
    extension: videoFileExtension;
  };
  unit: weightUnit;
  repetitions: number;
  restInterval: number;
};

const weightUnits: weightUnit[] = ["kg", "lb"];

const workoutLogSchema = new Schema<workoutLogDocument>(
  {
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
            formVideo: {
              size: {
                type: Number,
                min: [0, "File size cannot be negative"],
              },
              extension: {
                type: String,
                enum: {
                  values: validFileExtensions,
                  message: "Valid extensions are 'mov', 'mp4' and 'avi'",
                },
              },
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

workoutLogSchema.methods.generateWorkoutLogHeaderData = function (): workoutLogHeaderData {
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
  if (!set || !set.formVideo) return false;
  const videoKey = `${userId}/${this.id}/${exerciseId}.${setId}.${set.formVideo.extension}`;
  const result = await S3.deleteObject({
    Bucket: WLOGGER_BUCKET,
    Key: videoKey,
  }).promise();
  if (!result.$response.error) {
    set.formVideo = undefined;
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
      if (!set.formVideo?.extension) continue;
      const videoKey: string = `${userId}/${this.id}/${exercise.id}.${set.id}.${set.formVideo.extension}`;
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
  } x ${set?.weight} ${set?.unit}.${set?.formVideo?.extension}`;
};

export const WorkoutLog = model<workoutLogDocument>(
  "WorkoutLog",
  workoutLogSchema
);
