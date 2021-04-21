import { app } from "../src/app";
import request, { Test, Response } from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import { userDocument, User } from "../src/models/user";
import {
  WorkoutPlan,
  workoutPlanDocument,
  workoutPlanStatus,
} from "../src/models/workoutPlan";
import { Day, weightUnit } from "../src/models/workout";
import { NextFunction } from "express";

let user: userDocument;
const userData = { email: "test@test.com", password: "password" };

jest.mock("../src/middleware/auth", () => ({
  setCurrentUser: jest
    .fn()
    .mockImplementation(
      (req: Express.Request, res: Express.Response, next: NextFunction) => {
        req.currentUserId = user.id;
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
  user = await User.create({
    ...userData,
    confirmed: true,
  });
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
      workouts: [
        { dayOfWeek: "Monday", exercises: [validExerciseData] },
        { dayOfWeek: "Sunday", exercises: [validExerciseData] },
      ],
    },
    {
      position: 2,
      repeat: 2,
      workouts: [
        { dayOfWeek: "Tuesday", exercises: [validExerciseData] },
        { dayOfWeek: "Thursday", exercises: [validExerciseData] },
        { dayOfWeek: "Friday", exercises: [validExerciseData] },
      ],
    },
    {
      position: 3,
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
});
