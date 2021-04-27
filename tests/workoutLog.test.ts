import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User, userDocument } from "../src/models/user";
import { MONGO_TEST_URI } from "../src/util/database";
import { JWT_SECRET } from "../keys.json";
import {
  loggedExercise,
  WorkoutLog,
  workoutLogDocument,
} from "../src/models/workoutLog";
import { weightUnit } from "../src/models/workout";
import { workoutLogHeaderData } from "../src/models/workoutLog";

let token: string;
let user: userDocument;
const userData = { email: "test@test.com", password: "password" };

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
  token = jwt.sign(user?._id.toString(), JWT_SECRET);
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

interface workoutLogData {
  createdAt?: Date;
  updatedAt?: Date;
  exercises: Array<loggedExercise>;
}

const validWorkoutLogData: workoutLogData = {
  exercises: [
    {
      name: "Squats",
      sets: [
        { repetitions: 5, restInterval: 60, weight: 100, unit: "kg" },
        { repetitions: 10, restInterval: 69, weight: 200, unit: "kg" },
      ],
    },
    {
      name: "Deadlift",
      sets: [
        { repetitions: 5, restInterval: 60, weight: 100, unit: "kg" },
        { repetitions: 10, restInterval: 69, weight: 200, unit: "kg" },
        { repetitions: 5, restInterval: 60, weight: 100, unit: "kg" },
        { repetitions: 10, restInterval: 69, weight: 200, unit: "kg" },
      ],
    },
  ],
};

function postWorkoutLog(workoutLogData: workoutLogData): Test {
  return request(app)
    .post("/workoutLogs")
    .send(workoutLogData)
    .set("Authorisation", token);
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
      workoutLogData.exercises[0].sets[0].weight = (undefined as unknown) as number;
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog!.exercises[0].sets[0].weight).toBe(0);
    });

    it("should default the repetitions of an exercise to 0 if none is given", async () => {
      workoutLogData.exercises[0].sets[0].repetitions = (undefined as unknown) as number;
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog!.exercises[0].sets[0].repetitions).toBe(0);
    });

    it("should default the restInterval of an exercise to 0 if none is given", async () => {
      workoutLogData.exercises[0].sets[0].restInterval = (undefined as unknown) as number;
      await postWorkoutLog(workoutLogData);
      const workoutLog: workoutLogDocument | null = await WorkoutLog.findOne();
      expect(workoutLog!.exercises[0].sets[0].restInterval).toBe(0);
    });
  });

  describe("with invalid data", () => {
    it("should respond with a 406 if an exercise name is not given", async () => {
      workoutLogData.exercises[0].name = (undefined as unknown) as string;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.name");
      expect(response.body.error).toBe("Name is a required field");
    });

    it("should respond with a 406 if an exercise has no unit", async () => {
      workoutLogData.exercises[0].sets[0].unit = (undefined as unknown) as weightUnit;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.sets.0.unit");
      expect(response.body.error).toBe("Unit is a required field");
    });

    it("should respond with a 406 if an exercise has an invalid unit", async () => {
      workoutLogData.exercises[0].sets[0].unit = ("invalid unit" as unknown) as weightUnit;
      const response: Response = await postWorkoutLog(workoutLogData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("exercises.0.sets.0.unit");
      expect(response.body.error).toBe("Unit must be one of 'kg' or 'lb'");
    });
  });
});

describe("GET /workoutLogs", () => {
  it("should return an array of workout logs for the authorised user", async () => {
    await postWorkoutLog(validWorkoutLogData);
    await postWorkoutLog(validWorkoutLogData);
    const response: Response = await request(app)
      .get("/workoutLogs")
      .set("Authorisation", token);

    expect(response.status).toBe(200);
    const workoutLogHeaderData: workoutLogHeaderData[] = response.body;
    expect(workoutLogHeaderData).toHaveLength(2);
    expect(workoutLogHeaderData[0].setCount).toBe(6);
    expect(workoutLogHeaderData[0].exerciseCount).toBe(2);
  });
});

describe("GET /workoutLogs/:id", () => {
  function getWorkoutLog(id: string): Test {
    return request(app).get(`/workoutLogs/${id}`).set("Authorisation", token);
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
    return request(app)
      .delete(`/workoutLogs/${id}`)
      .set("Authorisation", token);
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
    const workoutLogToDelete: workoutLogDocument | null = await WorkoutLog.findOne(
      { _id: { $ne: workoutLog!.id } }
    );
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
});
