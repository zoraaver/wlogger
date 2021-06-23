import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import { MONGO_TEST_URI } from "../src/config/database";
import mongoose from "mongoose";
import { userDocument, User } from "../src/models/user";
import {
  WorkoutPlan,
  workoutPlanDocument,
  workoutPlanStatus,
} from "../src/models/workoutPlan";
import { incrementField } from "../src/models/workout";
import { NextFunction } from "express";
import { workoutLogData } from "./workoutLog.test";
import { ObjectID } from "bson";
import { WorkoutLog } from "../src/models/workoutLog";
import { Day, weightUnit } from "../src/util/util";
import { Exercise } from "../src/models/exercise";

interface exerciseData {
  name: string;
  restInterval: number;
  sets: number;
  repetitions?: number;
  weight?: number;
  unit: weightUnit;
  autoIncrement?: { field: incrementField; amount: number };
}

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

let user: userDocument;
const userData = { email: "test@test.com", password: "password" };

const validExerciseData: exerciseData = {
  name: "Squats",
  restInterval: 100,
  sets: 3,
  repetitions: 10,
  weight: 100,
  unit: "kg",
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
  await mongoose.connect(MONGO_TEST_URI + "_workoutPlan", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  });

  const exercise = await Exercise.create({ name: validExerciseData.name });

  user = await User.create({
    ...userData,
    confirmed: true,
    exercises: [exercise.id],
  });
});

afterEach(async () => {
  await WorkoutPlan.deleteMany({});
  await user.updateOne({ workoutPlans: [], currentWorkoutPlan: null });
});

afterAll(async () => {
  await WorkoutPlan.deleteMany({});
  await WorkoutLog.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

const validWorkoutPlanData: workoutPlanData = {
  name: "12 weeks",
  weeks: [
    {
      position: 1,
      workouts: [
        { dayOfWeek: "Monday", exercises: [validExerciseData] },
        { dayOfWeek: "Sunday", exercises: [validExerciseData] },
      ],
    },
    {
      position: 2,
      repeat: 2,
      workouts: [
        {
          dayOfWeek: "Tuesday",
          exercises: [
            {
              ...validExerciseData,
              autoIncrement: { field: "sets", amount: 2 },
            },
          ],
        },
        {
          dayOfWeek: "Thursday",
          exercises: [
            {
              ...validExerciseData,
              autoIncrement: { field: "repetitions", amount: 1 },
            },
          ],
        },
        {
          dayOfWeek: "Friday",
          exercises: [
            {
              ...validExerciseData,
              autoIncrement: { field: "weight", amount: 2.5 },
            },
          ],
        },
      ],
    },
    {
      position: 5,
      workouts: [
        { dayOfWeek: "Wednesday", exercises: [validExerciseData] },
        { dayOfWeek: "Saturday", exercises: [validExerciseData] },
      ],
    },
  ],
};

function postWorkoutPlan(workoutPlanData: workoutPlanData): Test {
  return request(app).post("/workoutPlans").send(workoutPlanData);
}

describe("POST /workoutPlans", () => {
  let workoutPlanData: workoutPlanData = { ...validWorkoutPlanData };
  afterEach(() => {
    // create a new deep copy of the valid data for every test
    workoutPlanData = {
      ...validWorkoutPlanData,
      weeks: validWorkoutPlanData.weeks.map((week: weekData) => ({
        ...week,
        workouts: week.workouts.map((workout: workoutData) => ({
          ...workout,
          exercises: workout.exercises.map((exercise: exerciseData) => ({
            ...exercise,
          })),
        })),
      })),
    };
  });

  describe("with valid data", () => {
    it("should insert a workout plan into the database", async () => {
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null =
        await WorkoutPlan.findOne();
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
      const workoutPlan: workoutPlanDocument | null =
        await WorkoutPlan.findOne();
      const workoutPlanId = workoutPlan?._id;
      const user: userDocument | null = await User.findOne();
      expect(user!.workoutPlans.slice(-1)[0]._id.toString()).toBe(
        workoutPlanId.toString()
      );
    });

    it("should default the status to 'Not started' if none is given in the request", async () => {
      await postWorkoutPlan(validWorkoutPlanData);
      const workoutPlan: workoutPlanDocument | null =
        await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.status).toBe("Not started");
    });

    it("should default the repeat of a week to 0 if none is given in the request", async () => {
      await postWorkoutPlan({
        ...workoutPlanData,
        weeks: [{ workouts: [], position: 1 }],
      });
      const workoutPlan: workoutPlanDocument | null =
        await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.weeks[0].repeat).toBe(0);
    });

    it("should default the number of repetitions of an exercise to 0 if none is given", async () => {
      delete workoutPlanData.weeks[0].workouts[0].exercises[0].repetitions;
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null =
        await WorkoutPlan.findOne().lean();
      expect(workoutPlan).not.toBeNull();
      expect(workoutPlan!.weeks[0].workouts[0].exercises[0].repetitions).toBe(
        0
      );
    });
    it("should default the weight of an exercise to 0 if none is given", async () => {
      delete workoutPlanData.weeks[0].workouts[0].exercises[0].weight;
      await postWorkoutPlan(workoutPlanData);
      const workoutPlan: workoutPlanDocument | null =
        await WorkoutPlan.findOne().lean();
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
        status: "Invalid status!" as unknown as workoutPlanStatus,
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("status");
      expect(response.body.error).toBe(
        "Status must be one of 'Completed', 'In Progress' or 'Not started'"
      );
    });

    it("should respond with a 406 if a week is missing a position", async () => {
      workoutPlanData.weeks[0].position = undefined as unknown as number;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.position");
      expect(response.body.error).toBe("Position is a required field");
    });

    it("should respond with a 406 if the position of a week is invalid", async () => {
      workoutPlanData.weeks[2].position = 3;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.2.position");
      expect(response.body.error).toBe(
        `Invalid position, expected ${validWorkoutPlanData.weeks[2].position}`
      );
    });

    it("should respond with a 406 if a workout does not have a day of the week", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].dayOfWeek =
        undefined as unknown as Day;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.dayOfWeek");
      expect(response.body.error).toBe("Day of the week is required");
    });

    it("should respond with a 406 if a workout has an invalid day of the week", async () => {
      // override type system on purpose to send bad data
      workoutPlanData.weeks[0].workouts[0].dayOfWeek =
        "I'm not a day!" as unknown as Day;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.dayOfWeek");
      expect(response.body.error).toBe("Invalid day of week");
    });

    it("should respond with a 406 if an exercise name is not in the user's list of exercises", async () => {
      workoutPlanData.weeks[0].workouts[0].exercises[0].name =
        "Some random name";
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.name");
      expect(response.body.error).toBe("Exercise name is not valid");
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
      workoutPlanData.weeks[0].workouts[0].exercises[0].unit =
        "I'm not a valid unit" as unknown as weightUnit;
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("weeks.0.workouts.0.exercises.0.unit");
      expect(response.body.error).toBe("Unit must be one of 'kg' or 'lb'");
    });

    it("should respond with a 406 if autoIncrement field is invalid", async () => {
      workoutPlanData.weeks[1].workouts[0].exercises[0].autoIncrement = {
        field: "invalid field" as unknown as incrementField,
        amount: 2,
      };
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe(
        "weeks.1.workouts.0.exercises.0.autoIncrement.field"
      );
      expect(response.body.error).toBe(
        "Increment field must be one of 'weight', 'repetitions' or 'sets'"
      );
    });

    it("should respond with a 406 if autoIncrement amount is a negative number", async () => {
      workoutPlanData.weeks[1].workouts[0].exercises[0].autoIncrement = {
        field: "sets",
        amount: -1,
      };
      const response: Response = await postWorkoutPlan(workoutPlanData);
      expect(response.status).toBe(406);
      expect(response.body.field).toBe(
        "weeks.1.workouts.0.exercises.0.autoIncrement.amount"
      );
      expect(response.body.error).toBe("Increment amount must be non-negative");
    });
  });
});

describe("GET /workoutPlans", () => {
  function getWorkoutPlans(): Test {
    return request(app).get("/workoutPlans");
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
    return request(app).get(`/workoutPlans/${id}`);
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
    return request(app).delete(`/workoutPlans/${id}`);
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
    const response: Response = await postWorkoutPlan(validWorkoutPlanData);
    await patchStartWorkoutPlan(response.body._id);
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
    return request(app).patch(`/workoutPlans/${id}`).send(data);
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

function patchStartWorkoutPlan(id: string): Test {
  return request(app).patch(`/workoutPlans/start/${id}`);
}
describe("PATCH /workoutPlans/start/:id", () => {
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

describe("GET /workoutPlans/nextWorkout", () => {
  function getNextWorkout(): Test {
    return request(app).get("/workoutPlans/nextWorkout");
  }

  function fakeCurrentDate(date: Date): void {
    jest.spyOn(global.Date, "now").mockImplementation(() => date.getTime());
  }

  async function startWorkoutPlanOnDate(date: Date): Promise<void> {
    const planResponse: Response = await postWorkoutPlan({
      ...validWorkoutPlanData,
    });
    await patchStartWorkoutPlan(planResponse!.body!._id);
    await WorkoutPlan.updateOne({}, { start: date });
  }

  it("should respond with a 404 if the user has no current workout plan", async () => {
    await user.updateOne({ currentWorkoutPlan: undefined });
    const response: Response = await getNextWorkout();
    expect(response.status).toBe(404);
    expect(response.body).toBe("No current workout plan found.");
  });

  it("should return 'Completed' if the current date is beyond the last date of the workout plan", async () => {
    await startWorkoutPlanOnDate(new Date(2000, 3));
    const response: Response = await getNextWorkout();
    expect(response.status).toBe(200);
    expect(response.body).toBe("Completed");
  });

  it("should update the plan as completed if the current date is beyond the last date of the workout plan", async () => {
    // start plan 5 weeks prior to current date
    await startWorkoutPlanOnDate(new Date(2021, 2, 25));
    // set today's date as a Monday after last week
    fakeCurrentDate(new Date(2021, 3, 26));
    await getNextWorkout();
    const workoutPlan: workoutPlanDocument | null = await WorkoutPlan.findOne();
    expect(workoutPlan!.status).toBe("Completed");
    expect(workoutPlan!.end.toDateString()).toBe(
      new Date(Date.now()).toDateString()
    );
  });

  it("should return 'All workouts have been completed' if there are no more workouts past the current date", async () => {
    // start plan 5 weeks prior to current date
    await startWorkoutPlanOnDate(new Date(2021, 2, 25));
    // set today's date as a Sunday on last day of plan => no workouts left
    fakeCurrentDate(new Date(2021, 3, 25));
    const response: Response = await getNextWorkout();
    expect(response.status).toBe(200);
    expect(response.body).toBe("All workouts in the plan have been completed.");
  });

  // workout plan structure:
  // weeks: [
  //   {
  //     position: 1,
  //     workouts: [
  //       { dayOfWeek: "Monday", exercises: [validExerciseData] },
  //       { dayOfWeek: "Sunday", exercises: [validExerciseData] },
  //     ],
  //   },
  //   {
  //     position: 2,
  //     repeat: 2,
  //     workouts: [
  //       { dayOfWeek: "Tuesday", exercises: [validExerciseData] },
  //       { dayOfWeek: "Thursday", exercises: [validExerciseData] },
  //       { dayOfWeek: "Friday", exercises: [validExerciseData] },
  //     ],
  //   },
  //   {
  //     position: 3,
  //     workouts: [
  //       { dayOfWeek: "Wednesday", exercises: [validExerciseData] },
  //       { dayOfWeek: "Saturday", exercises: [validExerciseData] },
  //     ],
  //   },
  // ],

  describe("should return the next workout from the current date otherwise", () => {
    beforeEach(async () => {
      // Thursday 25th March 2021 start date => first Monday is 22nd March 2021
      await startWorkoutPlanOnDate(new Date(2021, 2, 25));
    });
    it("set today's date as 26th March => next workout should be Sunday first week ", async () => {
      fakeCurrentDate(new Date(2021, 2, 26));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Sunday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Sun Mar 28 2021");
    });

    it("set today's date as 4th April => next workout should be Tuesday second week", async () => {
      fakeCurrentDate(new Date(2021, 3, 4));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Tuesday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Tue Apr 06 2021");
    });

    it("set today's date as 9th April => next workout should be Friday second week", async () => {
      fakeCurrentDate(new Date(2021, 3, 9));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Friday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Fri Apr 09 2021");
    });

    it("set today's date as 10th April => next workout should be Tuesday second week", async () => {
      fakeCurrentDate(new Date(2021, 3, 10));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Tuesday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Tue Apr 13 2021");
    });

    it("set today's date as 15th April => next workout should be Thursday second week", async () => {
      fakeCurrentDate(new Date(2021, 3, 15));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Thursday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Thu Apr 15 2021");
    });

    it("set today's date as 17th April => next workout should be Wednesday third week", async () => {
      fakeCurrentDate(new Date(2021, 3, 17));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Wednesday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Wed Apr 21 2021");
    });

    it("set today's date as 22nd April => next workout should be Saturday third week", async () => {
      fakeCurrentDate(new Date(2021, 3, 22));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.dayOfWeek).toBe("Saturday");
      const date: Date = new Date(response.body.date);
      expect(date.toDateString()).toBe("Sat Apr 24 2021");
    });
  });

  describe("should increment the workout as necessary", () => {
    let workoutPlan: workoutPlanDocument;

    beforeEach(async () => {
      // start workout plan on 5th April
      await startWorkoutPlanOnDate(new Date(2021, 3, 5));
      workoutPlan = (await WorkoutPlan.findOne()) as workoutPlanDocument;
    });

    function postWorkoutLog(
      workoutId: string,
      exerciseId: ObjectID,
      createdAt: Date,
      decrement: number = 0
    ): Test {
      // create workout log one week ago (22nd April 2021) with all sets/reps/weight possibly completed
      const setData = {
        repetitions: validExerciseData.repetitions as number,
        weight: validExerciseData.weight as number,
        unit: validExerciseData.unit,
        restInterval: validExerciseData.restInterval as number,
      };
      setData.repetitions -= decrement;
      const workoutLog: workoutLogData = {
        createdAt,
        workoutId,
        exercises: [
          {
            name: validExerciseData.name,
            exerciseId,
            sets: [setData, setData, setData],
          },
        ],
      };
      return request(app).post("/workoutLogs").send(workoutLog);
    }

    it("should increment the number of sets if the target is met", async () => {
      // log workout on 20th April (Tuesday) one week ago
      await postWorkoutLog(
        workoutPlan.weeks[1].workouts[0]._id,
        workoutPlan.weeks[1].workouts[0].exercises[0]._id,
        new Date(2021, 3, 20)
      );
      fakeCurrentDate(new Date(2021, 3, 27));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.exercises[0].sets).toBe(validExerciseData.sets + 2);
      expect(response.body.exercises[0].repetitions).toBe(
        validExerciseData.repetitions
      );
      expect(response.body.exercises[0].weight).toBe(validExerciseData.weight);
    });

    it("should increment the number of repetitions if the target is met", async () => {
      // log workout on 22th April (Thursday) one week ago
      await postWorkoutLog(
        workoutPlan.weeks[1].workouts[1]._id,
        workoutPlan.weeks[1].workouts[1].exercises[0]._id,
        new Date(2021, 3, 22)
      );
      fakeCurrentDate(new Date(2021, 3, 29));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.exercises[0].repetitions).toBe(
        (validExerciseData.repetitions as number) + 1
      );
      expect(response.body.exercises[0].weight).toBe(validExerciseData.weight);
      expect(response.body.exercises[0].sets).toBe(validExerciseData.sets);
    });

    it("should increment the weight if the target is met", async () => {
      // log workout on 23th April (Friday) one week ago
      await postWorkoutLog(
        workoutPlan.weeks[1].workouts[2]._id,
        workoutPlan.weeks[1].workouts[2].exercises[0]._id,
        new Date(2021, 3, 23)
      );
      fakeCurrentDate(new Date(2021, 3, 30));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.exercises[0].repetitions).toBe(
        validExerciseData.repetitions as number
      );
      expect(response.body.exercises[0].weight).toBe(
        (validExerciseData.weight as number) + 2.5
      );
      expect(response.body.exercises[0].sets).toBe(validExerciseData.sets);
      expect(response.body.exercises[0].repetitions).toBe(
        validExerciseData.repetitions
      );
    });

    it("should not increment anything if the target is not met", async () => {
      // log workout on 23th April (Friday) one week ago
      await postWorkoutLog(
        workoutPlan.weeks[1].workouts[2]._id,
        workoutPlan.weeks[1].workouts[2].exercises[0]._id,
        new Date(2021, 3, 23),
        1
      );
      fakeCurrentDate(new Date(2021, 3, 30));
      const response: Response = await getNextWorkout();
      expect(response.status).toBe(200);
      expect(response.body.exercises[0].repetitions).toBe(
        validExerciseData.repetitions as number
      );
      expect(response.body.exercises[0].weight).toBe(
        validExerciseData.weight as number
      );
      expect(response.body.exercises[0].sets).toBe(validExerciseData.sets);
      expect(response.body.exercises[0].repetitions).toBe(
        validExerciseData.repetitions
      );
    });
  });
});

describe("GET /workoutPlans/current", () => {
  function getCurrentPlan(): Test {
    return request(app).get("/workoutPlans/current");
  }
  it("should return the current workout plan of the user", async () => {
    let response: Response = await postWorkoutPlan(validWorkoutPlanData);
    await patchStartWorkoutPlan(response.body._id);
    response = await getCurrentPlan();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("name");
    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("weeks");
    expect(response.body.name).toBe(validWorkoutPlanData.name);
    expect(response.body.status).toBe("In progress");
    expect(response.body.weeks).toHaveLength(validWorkoutPlanData.weeks.length);
  });

  it("should return a 404 if there is no plan currently in progress", async () => {
    await postWorkoutPlan(validWorkoutPlanData);
    const response: Response = await getCurrentPlan();
    expect(response.status).toBe(404);
    expect(response.body).toBe("No current workout plan found.");
  });
});
