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

function postExercise(exercise: exerciseData): Test {
  return request(app).post("/exercises").send(exercise);
}

describe("POST /exercises", () => {
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

describe("GET /exercises", () => {
  function getExercises(): Test {
    return request(app).get("/exercises");
  }
  it("should respond with a list of the user's exercises sorted by name", async () => {
    await postExercise({ name: "Z", notes: "Zambi" });
    await postExercise({ name: "B" });
    await postExercise({ name: "A" });

    const response: Response = await getExercises();

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(3);
    expect(response.body[0].name).toBe("A");
    expect(response.body[1].name).toBe("B");
    expect(response.body[2].name).toBe("Z");
    expect(response.body[2].notes).toBe("Zambi");
  });
});

describe("DELETE /exercises/:id", () => {
  function deleteExercise(id: string): Test {
    return request(app).delete(`/exercises/${id}`);
  }

  it("should remove the exercise from the database", async () => {
    const postResponse = await postExercise(validExerciseData);
    await postExercise({ name: "Another exercise" });

    const exerciseToDeleteId = postResponse.body._id;

    const response: Response = await deleteExercise(exerciseToDeleteId);

    expect(response.status).toBe(200);
    expect(response.body).toBe(exerciseToDeleteId);
    expect(await Exercise.estimatedDocumentCount()).toBe(1);
  });

  it("should responsd with a 200 and remove the exercise id from the user's list of exercises", async () => {
    const postResponse = await postExercise(validExerciseData);
    await postExercise({ name: "Another exercise" });

    const exerciseToDeleteId = postResponse.body._id;

    await deleteExercise(exerciseToDeleteId);

    const user = (await User.findOne()) as userDocument;

    expect(user.exercises).toHaveLength(1);
  });
});
