import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import { userDocument, User } from "../src/models/user";
import { JWT_SECRET } from "../keys.json";
import jwt from "jsonwebtoken";
import { WorkoutPlan, workoutPlanDocument } from "../src/models/workoutPlan";
import { Day, weightUnit } from "../src/models/workout";

let token: string;
let user: userDocument;
const userData = { email: "test@test.com", password: "password" };

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  });
  user = await User.create({
    ...userData,
    confirmed: true,
  });
  token = jwt.sign(user._id.toString(), JWT_SECRET);
});

afterAll(async () => {
  await WorkoutPlan.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

interface workoutPlanData {
  name: string;
  length?: number;
  current?: boolean;
  weeks: Array<weekData>;
}

interface weekData {
  repeat?: number;
  position: number;
  workouts: Array<workoutData>;
}

interface workoutData {
  dayOfWeek: Day;
  exercises: Array<exerciseData>;
}

interface exerciseData {
  name: string;
  restInterval: number;
  sets: number;
  repetitions: number;
  weight: number;
  unit: weightUnit;
  autoIncrement?: boolean;
}

const validExerciseData: exerciseData = {
  name: "Squats",
  restInterval: 100,
  sets: 3,
  repetitions: 10,
  weight: 100,
  unit: "kg",
};

const validWorkoutPlanData: workoutPlanData = {
  name: "12 weeks",
  length: 12,
  weeks: [
    {
      position: 1,
      workouts: [{ dayOfWeek: "Monday", exercises: [validExerciseData] }],
    },
  ],
};
describe("POST /workoutPlans", () => {
  let workoutPlanData: workoutPlanData = { ...validWorkoutPlanData };
  afterEach(async () => {
    await WorkoutPlan.deleteMany({});
    workoutPlanData = {
      ...validWorkoutPlanData,
      weeks: [
        {
          ...validWorkoutPlanData.weeks[0],
          workouts: [
            {
              ...validWorkoutPlanData.weeks[0].workouts[0],
              exercises: [
                { ...validWorkoutPlanData.weeks[0].workouts[0].exercises[0] },
              ],
            },
          ],
        },
      ],
    };
  });

  function postWorkoutPlans(workoutPlanData: workoutPlanData): Test {
    return request(app)
      .post("/workoutPlans")
      .send(workoutPlanData)
      .set("Authorisation", token);
  }

  describe("with valid data", () => {
    it("should insert a workout plan into the database", async () => {
      await postWorkoutPlans(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        {
          name: workoutPlanData.name,
        }
      );
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.length).toBe(12);
    });

    it("should respond with the new workout plan and a 201", async () => {
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("length");
      expect(response.body.name).toBe(workoutPlanData.name);
      expect(response.body.length).toBe(workoutPlanData.length);
    });

    it("should add the workoutPlan id to the user who made the request", async () => {
      await postWorkoutPlans(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        {
          name: workoutPlanData.name,
        }
      );
      const workoutPlanId = workoutPlan?._id;
      const user: userDocument | null = await User.findOne({
        email: userData.email,
      });
      expect(user!.workoutPlans.slice(-1)[0]._id.toString()).toBe(
        workoutPlanId.toString()
      );
    });

    it("should set the current workout plan of the user if current is given", async () => {
      await postWorkoutPlans({ ...workoutPlanData, current: true });
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        {
          name: workoutPlanData.name,
        }
      );
      const workoutPlanId = workoutPlan?._id;
      const user: userDocument | null = await User.findOne({
        email: userData.email,
      });
      expect(user!.currentWorkoutPlan._id.toString()).toBe(
        workoutPlanId.toString()
      );
    });

    it("should default the length to 0 if none is given in the request", async () => {
      await postWorkoutPlans({
        ...workoutPlanData,
        length: (undefined as unknown) as number,
      });
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        { name: workoutPlanData.name }
      ).lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.length).toBe(0);
    });

    it("should default the repeat of a week to 0 if none is given in the request", async () => {
      await postWorkoutPlans({
        ...workoutPlanData,
        weeks: [{ workouts: [], position: 1 }],
      });
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        { name: workoutPlanData.name }
      ).lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.weeks[0].repeat).toBe(0);
    });
  });

  describe("with invalid data", () => {
    it("should respond with a 406 if the name is absent", async () => {
      const response: Response = await postWorkoutPlans({
        name: "",
        length: 12,
        weeks: [],
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("name");
      expect(response.body.error).toBe("Name is a required field");
    });

    it("should respond with a 406 if length is not a number", async () => {
      // purposefully override type system to allow posting of wrong data type
      const response: Response = await postWorkoutPlans({
        ...workoutPlanData,
        length: ("hello" as unknown) as number,
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("length");
      expect(response.body.error).toBe("Length must be a number");
    });

    it("should respond with a 406 if length is a negative number", async () => {
      const response: Response = await postWorkoutPlans({
        ...workoutPlanData,
        length: -1,
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("length");
      expect(response.body.error).toBe("Length must be a non-negative integer");
    });

    it("should respond with a 406 if two weeks have the same position", async () => {
      workoutPlanData.weeks = [
        { workouts: [], position: 1 },
        { workouts: [], position: 1 },
      ];
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.position");
      expect(response.body.error).toBe("Position must be unique for each week");
    });

    it("should respond with a 406 if a workout has an invalid day of the week", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].dayOfWeek = ("I'm not a day!" as unknown) as Day;
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.dayOfWeek");
      expect(response.body.error).toBe("Invalid day of week");
    });

    it("should respond with a 406 if an exercise has no name", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].name = (undefined as unknown) as string;
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.name");
      expect(response.body.error).toBe("Exercise name is required");
    });

    it("should respond with a 406 if sets is a non-positive number", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].sets = -1;
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.sets");
      expect(response.body.error).toBe("Sets must be a positive integer");
    });

    it("should respond with a 406 if repetitions is a negative number", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].repetitions = -1;
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe(
        "weeks.0.workouts.0.exercises.0.repetitions"
      );
      expect(response.body.error).toBe(
        "Repetitions must be a non-negative integer"
      );
    });

    it("should respond with a 406 if weight is a negative number", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].weight = -1;
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.weight");
      expect(response.body.error).toBe("Weight must be a non-negative number");
    });

    it("should respond with a 406 if an exercise has an invalid unit of weight", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].exercises[0].unit = ("I'm not a valid unit" as unknown) as weightUnit;
      const response: Response = await postWorkoutPlans(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.unit");
      expect(response.body.error).toBe("Unit must be one of 'kg' or 'lb'");
    });
  });
});
