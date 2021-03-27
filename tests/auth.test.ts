import { app } from "../src/app";
import request from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import User from "../src/models/user";

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const user = new User({ email: "test@test.com", password: "password" });
  await user.save();
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe("POST /auth/login", () => {
  type loginData = { email: string; password: string };

  function postLogin(data: loginData): request.Test {
    return request(app)
      .post("/auth/login")
      .send(data)
      .set("Accept", "application/json");
  }

  describe("with incorrect credentials", () => {
    it("should respond with a 401 if the user cannot be found", async () => {
      const response: request.Response = await postLogin({
        email: "john@gmail.com",
        password: "password",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should respond with a 401 if the password is incorrect", async () => {
      const response: request.Response = await postLogin({
        email: "test@test.com",
        password: "asdfdddd",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });
  });

  describe("with correct credentials", () => {
    it("should respond with the correct user data", async () => {
      const response = await postLogin({
        email: "test@test.com",
        password: "password",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe("test@test.com");
    });
  });
});
