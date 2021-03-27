import { app } from "../src/app";
import request from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import User, { userDocument } from "../src/models/user";

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe("POST /users", () => {
  type userData = {
    email: string;
    password: string;
    confirmPassword: string;
  };

  const validUserData: userData = {
    email: "test@test.com",
    password: "password",
    confirmPassword: "password",
  };

  function postUsers({
    email,
    password,
    confirmPassword,
  }: userData): request.Test {
    return request(app)
      .post("/users")
      .send({ email, password, confirmPassword })
      .set("Accept", "application/json");
  }

  describe("with a valid request body", () => {
    let response: request.Response;

    beforeAll(async () => {
      response = await postUsers(validUserData);
    });

    afterAll(async () => {
      await User.deleteMany({});
    });

    it("should respond with a new user", () => {
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toStrictEqual({
        email: validUserData.email,
        workoutPlans: [],
      });
    });

    it("should insert a user into the database", async () => {
      const user: userDocument | null = await User.findOne({
        email: validUserData.email,
      });
      expect(user).not.toBeNull();
    });
  });

  describe("with an invalid request body", () => {
    it("should respond with a 406 if the email is invalid", async () => {
      const response: request.Response = await postUsers({
        email: "23ijkljd@",
        password: "password",
        confirmPassword: "password",
      });
      expect(response.status).toBe(406);
      expect(response.body.message).toBe("Email is invalid");
    });

    it("should respond with a 406 if the password is absent", async () => {
      const response: request.Response = await postUsers({
        email: "test@test.com",
        password: "",
        confirmPassword: "",
      });
      expect(response.status).toBe(406);
      expect(response.body.message).toBe("Password is required");
    });

    it("should respond with a 406 if the password and password confirmation do not match", async () => {
      const response: request.Response = await postUsers({
        email: "test@test.com",
        password: "password",
        confirmPassword: "pasword",
      });
      expect(response.status).toBe(406);
      expect(response.body.message).toBe(
        "Password and confirm password do not match"
      );
    });

    it("should respond with a 406 if the email already exists", async () => {
      const user: userDocument = new User({
        email: "test@test.com",
        password: "password",
      });
      await user.save();
      const response: request.Response = await postUsers({
        email: "test@test.com",
        password: "password",
        confirmPassword: "password",
      });

      expect(response.status).toBe(406);
      expect(response.body.message).toBe("Email has already been taken");
    });
  });
});
