import { NextFunction } from "express";
import { User, userDocument } from "../src/models/user";
import mongoose from "mongoose";
import { MONGO_TEST_URI } from "../src/config/database";
import { Exercise, exerciseDocument } from "../src/models/exercise";
import request, { Test, Response } from "supertest";
import { app } from "../src/app";

let user: userDocument;
const userData = { email: "test@test.com", password: "password" };

interface exerciseData {
  name: string;
  notes?: string;
}

const validExerciseData: exerciseData = {
  name: "Squats",
  notes: "Breathe on the way up",
};

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
  await mongoose.connect(MONGO_TEST_URI + "_exercise", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: true,
  });

  user = await User.create({
    ...userData,
    confirmed: true,
  });
});

afterEach(async () => {
  await Exercise.deleteMany({});
  await user.updateOne({ exercises: [] });
});

afterAll(async () => {
  await User.deleteMany({});
  await Exercise.deleteMany({});
  await mongoose.disconnect();
});

describe("POST /exercises", () => {
  function postExercise(exercise: exerciseData): Test {
    return request(app).post("/exercises").send(exercise);
  }

  describe("with a valid request body", () => {
    it("should insert a new exercise into the database", async () => {
      await postExercise(validExerciseData);

      const exercise: exerciseDocument | null = await Exercise.findOne();

      expect(exercise).not.toBeNull();
      expect(exercise?.name).toBe(validExerciseData.name);
      expect(exercise?.notes).toBe(validExerciseData.notes);
    });

    it("respond with a 201 and the new exercise", async () => {
      const response: Response = await postExercise(validExerciseData);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(validExerciseData.name);
      expect(response.body.notes).toBe(validExerciseData.notes);
    });

    it("should add the exercise id to the authenticated users's list of exercises", async () => {
      await postExercise(validExerciseData);
      const user: userDocument | null = await User.findOne();
      const exercise: exerciseDocument | null = await Exercise.findOne();

      expect(user?.exercises).toHaveLength(1);
      expect(user?.exercises[0].toString()).toBe(exercise?.id);
    });
  });

  describe("with an invalid request body", () => {
    it("should respond with a 406 if the exercise name is missing", async () => {
      const response: Response = await postExercise({
        notes: "some notes",
      } as exerciseData);

      expect(response.status).toBe(406);
      expect(response.body.field).toBe("name");
      expect(response.body.error).toBe("Name is a required field");
    });

    it("should respond with a 406 if the exercise name is over 100 characters", async () => {
      const response: Response = await postExercise({
        ...validExerciseData,
        name: "a".repeat(101),
      });

      expect(response.status).toBe(406);
      expect(response.body.field).toBe("name");
      expect(response.body.error).toBe("Name must be at most 100 characters");
    });

    it("should respond with a 406 if the exercise notes is over 500 characters", async () => {
      const response: Response = await postExercise({
        ...validExerciseData,
        notes: "a".repeat(501),
      });

      expect(response.status).toBe(406);
      expect(response.body.field).toBe("notes");
      expect(response.body.error).toBe("Notes must be at most 500 characters");
    });
  });
});
