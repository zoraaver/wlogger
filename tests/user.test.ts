import { app } from "../src/app";
import request from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import User, { userDocument } from "../src/models/user";

describe("POST /users", () => {
  beforeAll(async () => {
    await mongoose.connect(MONGO_TEST_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("should create and return a new user if the request body is valid", async () => {
    const email: string = "test@gmail.com";
    const password: string = "password";
    const confirmPassword: string = "password";
    await request(app)
      .post("/users")
      .send({ email, password, confirmPassword })
      .set("Accept", "application/json")
      .expect(201);

    const user: userDocument | null = await User.findOne({ email });
    expect(user).toHaveProperty("email");
    expect(user?.email).toBe("test@gmail.com");
  });
});
