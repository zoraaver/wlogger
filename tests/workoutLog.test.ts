import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import mongoose from "mongoose";
import { User, userDocument } from "../src/models/user";
import { MONGO_TEST_URI } from "../src/config/database";
import {
  videoFileExtension,
  WorkoutLog,
  workoutLogDocument,
} from "../src/models/workoutLog";
import { weightUnit } from "../src/models/workout";
import { workoutLogHeaderData } from "../src/models/workoutLog";
import { NextFunction } from "express";
import { ObjectID } from "mongodb";
import { PresignedPost } from "aws-sdk/clients/s3";
import { WLOGGER_BUCKET } from "../src/config/env";
import { megaByte } from "../src/util/util";
import { Readable } from "stream";

let user: userDocument;
const userData = { email: "test@test.com", password: "password" };

type loggedSet = {
  weight: number;
  formVideoExtension?: videoFileExtension;
  unit: weightUnit;
  repetitions: number;
  restInterval: number;
  _id?: string;
};

type loggedExercise = {
  name: string;
  exerciseId?: ObjectID;
  _id?: string;
  sets: Array<loggedSet>;
};

// read video file before tests
const videoFile: string = "This is a pretend video file.";
const videoFileSize: number = videoFile.length;
const videoFileContent: Buffer = Buffer.from(videoFile, "utf-8");

// mock aws methods
const deleteObjectsArguments: AWS.S3.DeleteObjectsRequest[] = [];
const deleteObjectArguments: AWS.S3.DeleteObjectRequest[] = [];
const getObjectArguments: AWS.S3.GetObjectRequest[] = [];

const awsPostPolicyConditions = [
  ["starts-with", "$Content-Type", "video/"],
  ["content-length-range", 0, 50 * megaByte],
];

jest.mock("aws-sdk", () => ({
  S3: jest.fn().mockImplementation(() => {
    return {
      getObject: (params: AWS.S3.GetObjectRequest) => {
        getObjectArguments.push(params);
        return {
          createReadStream: () => {
            return Readable.from([videoFile]);
          },
        };
      },
      deleteObject: (params: AWS.S3.DeleteObjectRequest) => {
        deleteObjectArguments.push(params);
        return { promise: () => Promise.resolve({ $response: {} }) };
      },
      deleteObjects: (params: AWS.S3.DeleteObjectsRequest) => {
        deleteObjectsArguments.push(params);
        return { promise: () => Promise.resolve() };
      },
      listObjectsV2: (params: AWS.S3.ListObjectsV2Request) => {
        return {
          promise: () =>
            Promise.resolve({
              $response: {
                data: {
                  Contents: [
                    {
                      Size: videoFileSize.toString(),
                    },
                  ],
                },
              },
            }),
        };
      },
      createPresignedPost: (params: PresignedPost.Params) => {
        return {
          Bucket: params.Bucket,
          Conditions: params.Conditions,
          Expires: params.Expires,
          Fields: params.Fields,
        };
      },
    };
  }),
  config: { loadFromPath: () => {} },
}));

// mock auth middleware
jest.mock("../src/middleware/auth", () => ({
  setCurrentUser: jest
    .fn()
    .mockImplementation(
      async (
        req: Express.Request,
        res: Express.Response,
        next: NextFunction
      ) => {
        req.currentUser = (await User.findById(user.id)) as userDocument;
        next();
      }
    ),
  loggedIn: jest
    .fn()
    .mockImplementation(
      (req: Express.Request, res: Express.Response, next: NextFunction) => {
        next();
      }
    ),
}));

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI + "_workoutLog", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  });
  user = await User.create({
    ...userData,
    confirmed: true,
  });
});

afterEach(async () => {
  await WorkoutLog.deleteMany({});
  await user.updateOne({ workoutLogs: [] });
});

afterAll(async () => {
  await WorkoutLog.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

export interface workoutLogData {
  createdAt?: Date;
  updatedAt?: Date;
  workoutId?: string;
  exercises: Array<loggedExercise>;
  _id?: string;
}

const validWorkoutLogData: workoutLogData = {
  exercises: [
    {
      name: "Squats",
      sets: [
        {
          repetitions: 5,
          restInterval: 60,
          weight: 100,
          unit: "kg",
          formVideoExtension: "mov",
        },
        {
          repetitions: 10,
          restInterval: 69,
          weight: 200,
          unit: "kg",
          formVideoExtension: "mp4",
        },
      ],
    },
    {
      name: "Deadlift",
      sets: [
        {
          repetitions: 5,
          restInterval: 60,
          weight: 100,
          unit: "kg",
          formVideoExtension: "mov",
        },
        {
          repetitions: 10,
          restInterval: 69,
          weight: 200,
          unit: "kg",
          formVideoExtension: "avi",
        },
        {
          repetitions: 5,
          restInterval: 60,
          weight: 100,
          unit: "kg",
          formVideoExtension: "mp4",
        },
        { repetitions: 10, restInterval: 69, weight: 200, unit: "kg" },
      ],
    },
  ],
};

function postWorkoutLog(workoutLog: workoutLogData): Test {
  return request(app).post("/workoutLogs").send(workoutLog);
}

function generateVideoKeys(workoutLog: workoutLogData): string[] {
  const keys: string[] = [];
  for (const exercise of workoutLog.exercises) {
    for (const set of exercise.sets) {
      if (set.formVideoExtension)
        keys.push(
          `${user.id}/${workoutLog._id}/${exercise._id}.${set._id}.${set.formVideoExtension}`
        );
    }
  }
  return keys;
}

describe("POST /workoutLogs", () => {
  let workoutLogData: workoutLogData = validWorkoutLogData;
  afterEach(() => {
    workoutLogData = {
      ...validWorkoutLogData,
      exercises: validWorkoutLogData.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set })),
      })),
    };
  });

  describe("with valid data", () => {
    it("should insert a new workout log into the database", async () => {
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog).not.toBeNull();
      expect(workoutLog!.exercises).toHaveLength(2);
      expect(workoutLog!.exercises[0].sets).toHaveLength(2);
      expect(workoutLog!.createdAt.toDateString()).toBe(
        new Date().toDateString()
      );
    });

    it("should respond with the new workout log and a 201", async () => {
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).toHaveProperty("updatedAt");
      expect(response.body).toHaveProperty("exercises");
      expect(response.body.exercises).toHaveLength(2);
      expect(response.body.exercises[0]).toHaveProperty("sets");
      expect(response.body.exercises[0].sets).toHaveLength(2);
    });

    it("should add the workout log id to the user who made the request", async () => {
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      const user: userDocument | null = await User.findOne();

      expect(user!.workoutLogs[0].toString()).toBe(workoutLog!.id);
    });

    it("should default the weight of an exercise to 0 if none is given", async () => {
      workoutLogData.exercises[0].sets[0].weight =
        undefined as unknown as number;
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog!.exercises[0].sets[0].weight).toBe(0);
    });

    it("should default the repetitions of an exercise to 0 if none is given", async () => {
      workoutLogData.exercises[0].sets[0].repetitions =
        undefined as unknown as number;
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog!.exercises[0].sets[0].repetitions).toBe(0);
    });

    it("should default the restInterval of an exercise to 0 if none is given", async () => {
      workoutLogData.exercises[0].sets[0].restInterval =
        undefined as unknown as number;
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog!.exercises[0].sets[0].restInterval).toBe(0);
    });

    it("should create S3 presigned urls with the right conditions for each set with a video file extension", async () => {
      const response: Response = await postWorkoutLog(workoutLogData);
      const fakeResults: any[] = response.body.uploadUrls;
      const videoKeys: string[] = generateVideoKeys(response.body);
      expect(fakeResults).toHaveLength(5);
      fakeResults.forEach((result, index: number) => {
        expect(result.Bucket).toBe(WLOGGER_BUCKET);
        expect(result.Expires).toBe(600);
        expect(result.Conditions).toStrictEqual(awsPostPolicyConditions);
        expect(result.Fields.key).toBe(videoKeys[index]);
      });
    });

    it("should respond with a maximum of 5 presigned urls to upload videos", async () => {
      // add sixth file extension
      workoutLogData.exercises[1].sets[3].formVideoExtension = "mov";
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.body.uploadUrls).toHaveLength(5);
    });
  });

  describe("with invalid data", () => {
    it("should respond with a 406 if an exercise name is not given", async () => {
      workoutLogData.exercises[0].name = undefined as unknown as string;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.name");
      expect(response.body.error).toBe("Name is a required field");
    });

    it("should respond with a 406 if an exercise has no unit", async () => {
      workoutLogData.exercises[0].sets[0].unit =
        undefined as unknown as weightUnit;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.sets.0.unit");
      expect(response.body.error).toBe("Unit is a required field");
    });

    it("should respond with a 406 if an exercise has an invalid unit", async () => {
      workoutLogData.exercises[0].sets[0].unit =
        "invalid unit" as unknown as weightUnit;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.sets.0.unit");
      expect(response.body.error).toBe("Unit must be one of 'kg' or 'lb'");
    });

    it("should respond with a 406 if a file extension is invalid", async () => {
      workoutLogData.exercises[0].sets[0].formVideoExtension =
        "invalid extension" as unknown as videoFileExtension;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.sets.0.formVideoExtension");
      expect(response.body.error).toBe(
        "Valid extensions are 'mov', 'mp4' and 'avi'"
      );
    });
  });
});

describe("GET /workoutLogs", () => {
  it("should return an array of workout logs for the authorised user", async () => {
    await postWorkoutLog(validWorkoutLogData);
    await postWorkoutLog(validWorkoutLogData);
    const response: Response = await request(app).get("/workoutLogs");

    expect(response.status).toBe(200);
    const workoutLogHeaderData: workoutLogHeaderData[] = response.body;
    expect(workoutLogHeaderData).toHaveLength(2);
    expect(workoutLogHeaderData[0].setCount).toBe(6);
    expect(workoutLogHeaderData[0].exerciseCount).toBe(2);
  });
});

describe("GET /workoutLogs/:id", () => {
  function getWorkoutLog(id: string): Test {
    return request(app).get(`/workoutLogs/${id}`);
  }
  it("should return a workout log corresponding to the id in the request parameter", async () => {
    await postWorkoutLog(validWorkoutLogData);
    const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
    const response: Response = await getWorkoutLog(workoutLog!.id);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("exercises");
    expect(response.body.exercises).toHaveLength(2);
    expect(response.body.exercises[0].name).toBe("Squats");
    expect(response.body.exercises[0]).toHaveProperty("sets");
    expect(response.body.exercises[0].sets).toHaveLength(2);
    expect(response.body.exercises[0].sets[0].repetitions).toBe(5);
  });

  it("should respond with a 404 if the workout log does not belong to the authorised user", async () => {
    const workoutLog: workoutLogDocument = await WorkoutLog.create(
      validWorkoutLogData
    );
    const response: Response = await getWorkoutLog(workoutLog.id);
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `Cannot find workout log with id ${workoutLog.id}`
    );
  });
});

describe("DELETE /workoutLogs/:id", () => {
  function deleteWorkoutLog(id: string): Test {
    return request(app).delete(`/workoutLogs/${id}`);
  }

  it("should respond with a 200 and remove the workout log from the database", async () => {
    await postWorkoutLog(validWorkoutLogData);
    const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
    const response: Response = await deleteWorkoutLog(workoutLog!.id);
    expect(response.status).toBe(200);
    expect(response.body).toBe(workoutLog!.id);
    const workoutLogCount: number = await WorkoutLog.estimatedDocumentCount();
    expect(workoutLogCount).toBe(0);
  });

  it("should remove the workout log from the authorised user's workout logs", async () => {
    await postWorkoutLog(validWorkoutLogData);
    const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
    await postWorkoutLog(validWorkoutLogData);
    const workoutLogToDelete: workoutLogDocument | null =
      await WorkoutLog.findOne({ _id: { $ne: workoutLog!.id } });
    await deleteWorkoutLog(workoutLogToDelete!.id);
    const user: userDocument | null = await User.findOne();
    expect(user!.workoutLogs).toHaveLength(1);
    expect(user!.workoutLogs[0]._id.toString()).toBe(workoutLog!.id);
  });

  it("should respond with a 404 if the workout log does not belong to the authorised user", async () => {
    const workoutLog: workoutLogDocument = await WorkoutLog.create(
      validWorkoutLogData
    );
    const response: Response = await deleteWorkoutLog(workoutLog!.id);
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `Cannot find workout log with id ${workoutLog!.id}`
    );
  });

  it("should delete all associated videos in S3", async () => {
    await postWorkoutLog(validWorkoutLogData);
    const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
    await deleteWorkoutLog(workoutLog!.id);
    const keys: string[] = generateVideoKeys(workoutLog as workoutLogData);
    const lastDeleteObjectsArg: AWS.S3.DeleteObjectsRequest =
      deleteObjectsArguments[deleteObjectsArguments.length - 1];
    expect(lastDeleteObjectsArg.Bucket).toBe(WLOGGER_BUCKET);
    lastDeleteObjectsArg.Delete.Objects.forEach(
      (deletedObject, index: number) => {
        expect(deletedObject.Key).toBe(keys[index]);
      }
    );
  });
});

describe("DELETE /workoutLogs/:id/exercises/:exerciseId/sets/:setId", () => {
  function deleteSetVideo(id: string, exerciseId: string, setId: string): Test {
    return request(app).delete(
      `/workoutLogs/${id}/exercises/${exerciseId}/sets/${setId}`
    );
  }
  it("should remove the updated set's video extension and return the appropriate set/exercise index", async () => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[0];
    const exerciseId = exercise._id;
    const setId = exercise.sets[1]._id;
    response = await deleteSetVideo(response.body._id, exerciseId, setId);
    expect(response.status).toBe(200);
    expect(response.body.setId).toBe(setId);
    expect(response.body.exerciseId).toBe(exerciseId);
    const workoutLog = (await WorkoutLog.findOne()) as workoutLogDocument;
    expect(workoutLog.exercises[0].sets[1].formVideoExtension).toBeUndefined();
  });

  it("should remove the video in S3", async () => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[0];
    const set = exercise.sets[1];
    const keyToDelete: string = `${user.id}/${response.body._id}/${exercise._id}.${set._id}.${set.formVideoExtension}`;
    response = await deleteSetVideo(response.body._id, exercise._id, set._id);
    const lastDeleteObjectArg: AWS.S3.DeleteObjectRequest =
      deleteObjectArguments[deleteObjectArguments.length - 1];
    expect(lastDeleteObjectArg.Bucket).toBe(WLOGGER_BUCKET);
    expect(lastDeleteObjectArg.Key).toBe(keyToDelete);
  });

  it("should respond with a 404 if the exercise/set cannot be found", async () => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[0];
    const setId = exercise.sets[1]._id;
    response = await deleteSetVideo(response.body._id, "some random id", setId);
    expect(response.status).toBe(404);
    expect(response.body).toBe("");
  });
});

describe("GET /workoutLogs/:id/exercises/:exerciseId/sets/:setId/video", () => {
  function getSetVideo(id: string, exerciseId: string, setId: string): Test {
    return request(app).get(
      `/workoutLogs/${id}/exercises/${exerciseId}/sets/${setId}/video`
    );
  }

  function parseResponseBody(
    res: Response,
    callback: (error: Error | null, body: any) => void
  ) {
    let data: string = "";
    res.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    res.on("end", () => {
      callback(null, data);
    });
  }

  it("should respond with a complete video stream and the correct headers if the set has an attached video", async () => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[0];
    const set = exercise.sets[0];
    response = await getSetVideo(response.body._id, exercise._id, set._id);
    const today: string = new Date(Date.now()).toDateString();
    const displayFileName: string = `${today}: ${exercise.name}, ${set.repetitions} x ${set.weight} ${set.unit}.${set.formVideoExtension}`;
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(videoFileContent);
    expect(response.headers["content-type"]).toBe("video/quicktime");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="${displayFileName}"`
    );
  });

  it("should respond with a partial content range if a range is specified in the request headers", async (done) => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[0];
    const set = exercise.sets[0];
    // request the whole file
    getSetVideo(response.body._id, exercise._id, set._id)
      .set("Range", `bytes=1-${videoFileSize}`)
      .buffer(true)
      .parse(parseResponseBody)
      .then((res: Response) => {
        const fileSize = videoFileSize.toString();
        expect(res.status).toBe(206);
        expect(res.headers["content-disposition"]).toBe("inline");
        expect(res.headers["accept-ranges"]).toBe("bytes");
        expect(res.headers["content-length"]).toBe(fileSize);
        expect(res.headers["content-range"]).toBe(
          `bytes 1-${fileSize}/${fileSize}`
        );
        expect(res.body).toBe(videoFileContent.toString());
        done();
      });
  });

  it("should respond with a 404 if the set/exercise cannot be found", async () => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[0];
    response = await getSetVideo(
      response.body._id,
      exercise._id,
      "some random id"
    );
    expect(response.status).toBe(404);
    expect(response.body).toBe("");
  });

  it("should respond with a 404 if the set does not have a video file extension", async () => {
    let response: Response = await postWorkoutLog(validWorkoutLogData);
    const exercise = response.body.exercises[1];
    const setId = exercise.sets[3]._id;
    response = await getSetVideo(response.body._id, exercise._id, setId);
    expect(response.status).toBe(404);
    expect(response.body).toBe("");
  });
});
