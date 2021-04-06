import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import { userDocument, User } from "../src/models/user";
import { JWT_SECRET } from "../keys.json";
import jwt from "jsonwebtoken";
import { WorkoutPlan, workoutPlanDocument } from "../src/models/workoutPlan";

let token: string;
let user: userDocument;
const userData = { email: "test@test.com", password: "password" };
beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
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
}

describe("POST /workoutPlans", () => {
  afterEach(async () => {
    await WorkoutPlan.deleteMany({});
  });

  const validWorkoutPlanData = {
    name: "12 weeks",
    length: 12,
  };

  function postWorkoutPlans(workoutPlanData: workoutPlanData): Test {
    return request(app)
      .post("/workoutPlans")
      .send(workoutPlanData)
      .set("Authorisation", token);
  }

  describe("with valid data", () => {
    it("should insert a workout plan into the database", async () => {
      await postWorkoutPlans(validWorkoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        {
          name: validWorkoutPlanData.name,
        }
      );
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.length).toBe(12);
    });

    it("should respond with the new workout plan and a 201", async () => {
      const response: Response = await postWorkoutPlans(validWorkoutPlanData);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("workoutPlan");
      expect(response.body.workoutPlan.name).toBe(validWorkoutPlanData.name);
      expect(response.body.workoutPlan.length).toBe(
        validWorkoutPlanData.length
      );
    });

    it("should add the workoutPlan id to the user who made the request", async () => {
      await postWorkoutPlans(validWorkoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        {
          name: validWorkoutPlanData.name,
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
      await postWorkoutPlans({ ...validWorkoutPlanData, current: true });
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne(
        {
          name: validWorkoutPlanData.name,
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
  });

  describe("with invalid data", () => {
    it("should respond with a 406 if the name is absent", async () => {
      const response: Response = await postWorkoutPlans({
        name: "",
        length: 12,
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("name");
      expect(response.body.error).toBe("Name is a required field");
    });
  });
});
