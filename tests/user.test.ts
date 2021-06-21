import { app } from "../src/app";
import request, { Test } from "supertest";
import { MONGO_TEST_URI } from "../src/config/database";
import mongoose from "mongoose";
import { userDocument, User } from "../src/models/user";
import bcrypt from "bcryptjs";
import sgMail from "@sendgrid/mail";
import jwt from "jsonwebtoken";
import {
  CLIENT_URL,
  JWT_EMAIL_VERIFICATION_SECRET,
  VERIFICATION_EMAIL_TEMPLATE_ID,
} from "../src/config/env";

jest.mock("@sendgrid/mail");
jest.mock("aws-sdk");

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI + "_user", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: true,
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

  function postUser({ email, password, confirmPassword }: userData): Test {
    return request(app)
      .post("/users")
      .send({ email, password, confirmPassword })
      .set("Accept", "application/json");
  }

  describe("with a valid request body", () => {
    let response: request.Response;

    beforeAll(async () => {
      response = await postUser(validUserData);
    });

    afterAll(async () => {
      await User.deleteMany({});
    });

    it("should respond with a new user", () => {
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toStrictEqual({
        email: validUserData.email,
      });
    });

    it("should insert a user into the database", async () => {
      const user: userDocument | null = await User.findOne();
      expect(user).not.toBeNull();
    });

    it("should store a hashed password in the database", async () => {
      const user: userDocument | null = await User.findOne({
        email: validUserData.email,
      });
      expect(user).not.toBeNull();
      expect(user!.password).not.toBeNull();
      expect(await bcrypt.compare("password", user!.password as string)).toBe(
        true
      );
    });

    it("should send a verification email to the user's email address", async () => {
      const verifyLinkRegex: string = `^${CLIENT_URL}/verify/`;

      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send).lastCalledWith({
        from: { email: "app@wlogger.uk", name: "wLogger" },
        to: validUserData.email,
        dynamicTemplateData: {
          verifyLink: expect.stringMatching(new RegExp(verifyLinkRegex)),
        },
        templateId: VERIFICATION_EMAIL_TEMPLATE_ID,
      });

      const verifyLink = (sgMail.send as any).mock.calls[0][0]
        .dynamicTemplateData.verifyLink;
      const verificationToken = verifyLink.split("/").pop();

      const user = await User.findOne();

      expect(
        (jwt.verify(verificationToken, JWT_EMAIL_VERIFICATION_SECRET) as any)
          .userId
      ).toEqual(user?.id);
    });
  });

  describe("with an invalid request body", () => {
    it("should respond with a 406 if the email is invalid", async () => {
      const response: request.Response = await postUser({
        email: "23ijkljd@",
        password: "password",
        confirmPassword: "password",
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("email");
      expect(response.body.error).toBe("Email is invalid");
    });

    it("should respond with a 406 if the password is absent", async () => {
      const response: request.Response = await postUser({
        email: "test@test.com",
        password: "",
        confirmPassword: "",
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("password");
      expect(response.body.error).toBe("Password is required");
    });

    it("should respond with a 406 if the password and password confirmation do not match", async () => {
      const response: request.Response = await postUser({
        email: "test@test.com",
        password: "password",
        confirmPassword: "pasword",
      });
      expect(response.status).toBe(406);
      expect(response.body.field).toBe("confirmPassword");
      expect(response.body.error).toBe(
        "Confirm password does not match password"
      );
    });

    it("should respond with a 406 if the email already exists", async () => {
      const user: userDocument = new User({
        email: "test@test.com",
        password: "password",
      });
      await user.save();
      const response: request.Response = await postUser({
        email: "test@test.com",
        password: "password",
        confirmPassword: "password",
      });

      expect(response.status).toBe(406);
      expect(response.body.field).toBe("email");
      expect(response.body.error).toBe("Email has already been taken");
    });
  });
});
