import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import { userDocument, User } from "../src/models/user";
import { JWT_SECRET } from "../keys.json";
import jwt from "jsonwebtoken";
import {
  WorkoutPlan,
  workoutPlanDocument,
  workoutPlanStatus,
} from "../src/models/workoutPlan";
import { Day, weightUnit } from "../src/models/workout";

let token: string;
let user: userDocument | null;
const userData = { email: "test@test.com", password: "password" };

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI + "_workoutPlan", {
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
  await WorkoutPlan.deleteMany({});
});

afterAll(async () => {
  await WorkoutPlan.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

interface workoutPlanData {
  name: string;
  current?: boolean;
  status?: workoutPlanStatus;
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
  repetitions?: number;
  weight?: number;
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
  weeks: [
    {
      position: 1,
      workouts: [{ dayOfWeek: "Monday", exercises: [validExerciseData] }],
    },
  ],
};

function postWorkoutPlan(workoutPlanData: workoutPlanData): Test {
  return request(app)
    .post("/workoutPlans")
    .send(workoutPlanData)
    .set("Authorisation", token);
}

describe("POST /workoutPlans", () => {
  let workoutPlanData: workoutPlanData = { ...validWorkoutPlanData };
  afterEach(() => {
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

  describe("with valid data", () => {
    it("should insert a workout plan into the database", async () => {
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
      expect(workoutPlan).not.toBeNull();
    });

    it("should respond with the new workout plan and a 201", async () => {
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("name");
      expect(response.body.name).toBe(workoutPlanData.name);
    });

    it("should add the workoutPlan id to the user who made the request", async () => {
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
      const workoutPlanId = workoutPlan?._id;
      const user: userDocument | null = await User.findOne();
      expect(user!.workoutPlans.slice(-1)[0]._id.toString()).toBe(
        workoutPlanId.toString()
      );
    });

    it("should set the current workout plan of the user if current is given", async () => {
      await postWorkoutPlan({ ...workoutPlanData, current: true });
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
      const workoutPlanId = workoutPlan?._id;
      const user: userDocument | null = await User.findOne();
      expect(user!.currentWorkoutPlan._id.toString()).toBe(
        workoutPlanId.toString()
      );
    });

    it("should default the status to 'Not started' if none is given in the request", async () => {
      await postWorkoutPlan(validWorkoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.status).toBe("Not started");
    });

    it("should default the repeat of a week to 0 if none is given in the request", async () => {
      await postWorkoutPlan({
        ...workoutPlanData,
        weeks: [{ workouts: [], position: 1 }],
      });
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.weeks[0].repeat).toBe(0);
    });

    it("should default the number of repetitions of an exercise to 0 if none is given", async () => {
      delete workoutPlanData.weeks[0].workouts[0].exercises[0].repetitions;
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.weeks[0].workouts[0].exercises[0].repetitions).toBe(
        0
      );
    });
    it("should default the weight of an exercise to 0 if none is given", async () => {
      delete workoutPlanData.weeks[0].workouts[0].exercises[0].weight;
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.weeks[0].workouts[0].exercises[0].weight).toBe(0);
    });
  });

  describe("with invalid data", () => {
    it("should respond with a 406 if the name is absent", async () => {
      const response: Response = await postWorkoutPlan({
        name: "",
        weeks: [],
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("name");
      expect(response.body.error).toBe("Name is a required field");
    });

    it("should respond with a 406 if status is an invalid status", async () => {
      const response: Response = await postWorkoutPlan({
        ...workoutPlanData,
        status: ("Invalid status!" as unknown) as workoutPlanStatus,
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("status");
      expect(response.body.error).toBe(
        "Status must be one of 'Completed', 'In Progress' or 'Not started'"
      );
    });

    it("should respond with a 406 if a week is missing a position", async () => {
      workoutPlanData.weeks[0].position = (undefined as unknown) as number;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.position");
      expect(response.body.error).toBe("Position is a required field");
    });

    it("should respond with a 406 if two weeks have the same position", async () => {
      workoutPlanData.weeks = [
        { workouts: [], position: 1 },
        { workouts: [], position: 1 },
      ];
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.position");
      expect(response.body.error).toBe("Position must be unique for each week");
    });

    it("should respond with a 406 if a workout does not have a day of the week", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].dayOfWeek = (undefined as unknown) as Day;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.dayOfWeek");
      expect(response.body.error).toBe("Day of the week is required");
    });

    it("should respond with a 406 if a workout has an invalid day of the week", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].dayOfWeek = ("I'm not a day!" as unknown) as Day;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.dayOfWeek");
      expect(response.body.error).toBe("Invalid day of week");
    });

    it("should respond with a 406 if an exercise has no name", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].name = (undefined as unknown) as string;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.name");
      expect(response.body.error).toBe("Exercise name is required");
    });

    it("should respond with a 406 if sets is a non-positive number", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].sets = -1;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.sets");
      expect(response.body.error).toBe("Sets must be a positive integer");
    });

    it("should respond with a 406 if repetitions is a negative number", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].repetitions = -1;
      const response: Response = await postWorkoutPlan(workoutPlanData);
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
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.weight");
      expect(response.body.error).toBe("Weight must be a non-negative number");
    });

    it("should respond with a 406 if an exercise has an invalid unit of weight", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].exercises[0].unit = ("I'm not a valid unit" as unknown) as weightUnit;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.unit");
      expect(response.body.error).toBe("Unit must be one of 'kg' or 'lb'");
    });
  });
});

describe("GET /workoutPlans", () => {
  function getWorkoutPlans(): Test {
    return request(app).get("/workoutPlans").set("Authorisation", token);
  }

  it("should respond with a 200 and array of the user's workout plans", async () => {
    await Promise.all([
      postWorkoutPlan(validWorkoutPlanData),
      postWorkoutPlan(validWorkoutPlanData),
    ]);
    const response: Response = await getWorkoutPlans();
    expect(response.status).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
    const plans = response.body as workoutPlanData[];
    expect(plans.length).toBe(2);
    expect(plans[0].name).toBe(validWorkoutPlanData.name);
  });
});

describe("GET /workoutPlans/:id", () => {
  function getWorkoutPlan(id: string): Test {
    return request(app).get(`/workoutPlans/${id}`).set("Authorisation", token);
  }

  it("should respond with a 200 and the workout plan matching the id in the request parameter", async () => {
    await postWorkoutPlan(validWorkoutPlanData);
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
    const response: Response = await getWorkoutPlan(workoutPlan?.id);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("name");
    expect(response.body.name).toBe(validWorkoutPlanData.name);
  });

  it("should respond with a 404 if the workout plan does not belong to the authorised user", async () => {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create(
      validWorkoutPlanData
    );
    const response: Response = await getWorkoutPlan(workoutPlan.id);
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `Cannot find workout plan with id ${workoutPlan.id}`
    );
  });
});

describe("DELETE /workoutPlans/:id", () => {
  function deleteWorkoutPlan(id: string) {
    return request(app)
      .delete(`/workoutPlans/${id}`)
      .set("Authorisation", token);
  }
  it("should respond with a 200 and remove the workout plan from the database", async () => {
    await postWorkoutPlan(validWorkoutPlanData);
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
    const response: Response = await deleteWorkoutPlan(workoutPlan!.id);
    expect(response.status).toBe(200);
    expect(response.body).toBe(workoutPlan!.id);
    const workoutPlanCount: number = await WorkoutPlan.estimatedDocumentCount(
      {}
    );
    expect(workoutPlanCount).toBe(0);
  });

  it("should remove the workout plan id from the user's workout plans in the database", async () => {
    user = user as userDocument;
    // remove all previous workout plans
    user.workoutPlans = (undefined as unknown) as any[];
    await user.save();

    await postWorkoutPlan({ ...validWorkoutPlanData, current: true });
    await postWorkoutPlan({ ...validWorkoutPlanData, name: "another plan" });
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne({
      name: validWorkoutPlanData.name,
    });
    await deleteWorkoutPlan(workoutPlan!.id);
    user = (await User.findById(user.id)) as userDocument;
    expect(user.workoutPlans).toHaveLength(1);
    expect(user.currentWorkoutPlan).toBeUndefined();
  });

  it("should respond with a 404 if the workout plan does not belong to the authorised user", async () => {
    const workoutPlan: workoutPlanDocument = await WorkoutPlan.create(
      validWorkoutPlanData
    );
    const response: Response = await deleteWorkoutPlan(workoutPlan.id);
    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `Cannot find workout plan with id ${workoutPlan.id}`
    );
    const workoutPlanCount: number = await WorkoutPlan.estimatedDocumentCount(
      {}
    );
    expect(workoutPlanCount).toBe(1);
  });
});

describe("PATCH /workoutPlans/:id", () => {
  function patchWorkoutPlan(id: string, data: workoutPlanData): Test {
    return request(app)
      .patch(`/workoutPlans/${id}`)
      .send(data)
      .set("Authorisation", token);
  }
  it("should respond with a 200 and update the workout plan in the database", async () => {
    await postWorkoutPlan(validWorkoutPlanData);
    const workoutPlan = await WorkoutPlan.findOne();
    const response: Response = await patchWorkoutPlan(workoutPlan!.id, {
      name: "Changed the name",
      weeks: [],
    });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Changed the name");
    expect(response.body.weeks).toHaveLength(0);
  });

  it("should respond with a 404 if the workout plan does not belong to the authorised user", async () => {
    let workoutPlan: workoutPlanDocument | null = await WorkoutPlan.create(
      validWorkoutPlanData
    );
    const response = await patchWorkoutPlan(workoutPlan!.id, {
      name: "some other name",
      weeks: [],
    });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(
      `Cannot find workout plan with id ${workoutPlan!.id}`
    );
    workoutPlan = await WorkoutPlan.findOne();
    expect(workoutPlan!.name).toBe(validWorkoutPlanData.name);
  });
});

describe("PATCH /workoutPlans/start/:id", () => {
  function patchStartWorkoutPlan(id: string): Test {
    return request(app)
      .patch(`/workoutPlans/start/${id}`)
      .set("Authorisation", token);
  }
  it("should update the workout plan's status to 'In Progress'", async () => {
    const response: Response = await postWorkoutPlan(validWorkoutPlanData);
    const workoutPlanId: string = response.body._id;
    await patchStartWorkoutPlan(workoutPlanId);
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
    expect(workoutPlan!.status).toBe("In progress");
  });

  it("should set the plan as the current workout plan", async () => {
    const response: Response = await postWorkoutPlan(validWorkoutPlanData);
    const workoutPlanId: string = response.body._id;
    await patchStartWorkoutPlan(workoutPlanId);
    const user: userDocument | null = await User.findOne();
    expect(user!.currentWorkoutPlan._id.toString()).toBe(workoutPlanId);
  });

  it("should set the previous currentWorkoutPlan's status to 'Not started'", async () => {
    // create a new plan and assign it as the user's current plan
    let response: Response = await postWorkoutPlan(validWorkoutPlanData);
    const workoutPlanId: string = response.body._id;
    await patchStartWorkoutPlan(workoutPlanId);
    // create another plan and start it
    response = await postWorkoutPlan(validWorkoutPlanData);
    await patchStartWorkoutPlan(response.body._id);
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findById(
      workoutPlanId
    );
    // expect original plan's status to be set to 'Not Started'
    expect(workoutPlan!.status).toBe("Not started");
  });
});
