import { app } from "../src/app";
import jwt from "jsonwebtoken";
import request, { Response, Test } from "supertest";
import { MONGO_TEST_URI } from "../src/util/database";
import mongoose from "mongoose";
import User, { userDocument } from "../src/models/user";

type loginData = { email: string; password: string };

const validLoginData: loginData = {
  email: "test@test.com",
  password: "password",
};

const JWT_SECRET = process.env.JWT_SECRET as string;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID as string;

beforeAll(async () => {
  await mongoose.connect(MONGO_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const user = new User(validLoginData);
  await user.save();
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe("POST /auth/login", () => {
  afterAll(async () => {
    await User.deleteMany({});
  });

  function postLogin(data: loginData): Test {
    return request(app)
      .post("/auth/login")
      .send(data)
      .set("Accept", "application/json");
  }

  describe("with invalid credentials", () => {
    it("should respond with a 401 if the user cannot be found", async () => {
      const response: Response = await postLogin({
        email: "john@gmail.com",
        password: "password",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should respond with a 401 if the password is incorrect", async () => {
      const response: Response = await postLogin({
        email: validLoginData.email,
        password: "asdfdddd",
      });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should respond with a 403 if the user has a google id", async () => {
      const email = "another@test.com";
      const user: userDocument | null = await User.create({
        email,
        googleId: "fake google id",
      });
      const response: Response = await postLogin({
        email,
        password: "password",
      });
      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Please sign in with google");
      await user.delete();
    });
  });

  describe("with valid credentials", () => {
    it("should respond with the correct user data", async () => {
      const response: Response = await postLogin(validLoginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(validLoginData.email);
    });

    it("should respond with a JWT containing the user's id", async () => {
      const response: Response = await postLogin(validLoginData);

      const user: userDocument | null = await User.findOne(
        { email: validLoginData.email },
        "_id"
      );

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("token");
      const token: string = response.body.user.token;
      expect(jwt.verify(token, JWT_SECRET)).toBe(
        // user and user._id must be defined at this point as the user is inserted into the db before all tests
        user!._id!.toString()
      );
    });
  });
});

const validIdToken: string = "valid token";
const email: string = "test@gmail.com";
const googleId: string = "mock google id";

// mock verifyIdToken method from google auth library
jest.mock("google-auth-library", () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: (options: { idToken: string; audience: string }) => {
          const { idToken } = options;
          return {
            getPayload: () => {
              if (idToken === validIdToken)
                return {
                  email,
                  sub: googleId,
                  aud: GOOGLE_CLIENT_ID,
                };
              throw new Error("Invalid token");
            },
          };
        },
      };
    }),
  };
});

describe("POST /auth/google", () => {
  function postGoogleLogin(idToken: string): Test {
    return request(app)
      .post("/auth/google")
      .send({ idToken })
      .set("Accept", "application/json");
  }

  describe("with invalid credentials", () => {
    it("should respond with a 401 if the id token is not valid", async () => {
      const userCount: number = await User.estimatedDocumentCount();
      const response: Response = await postGoogleLogin("invalid token!");
      expect(response.status).toBe(401);
      expect(response.body.message).toBe("Authentication failed");
      expect(await User.estimatedDocumentCount()).toBe(userCount);
    });
  });

  describe("with valid credentials", () => {
    afterEach(async () => {
      await User.deleteMany({});
    });

    it("should create a user if the user is not already present in the database", async () => {
      const response: Response = await postGoogleLogin(validIdToken);
      expect(response.status).toBe(201);
      expect(response.body.user).toHaveProperty("token");
      const token: string = response.body.user.token;

      const user: userDocument | null = await User.findOne({ email });
      expect(user).not.toBeNull();
      expect(user!.email).toBe(email);
      expect(user!.googleId).toBe(googleId);
      expect(jwt.verify(token, JWT_SECRET)).toBe(user!._id!.toString());
    });

    it("should respond with a JWT for an already existing user with a google id", async () => {
      const user: userDocument | null = await User.create({ email, googleId });
      const response: Response = await postGoogleLogin(validIdToken);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("token");
      const token: string = response.body.user.token;
      expect(jwt.verify(token, JWT_SECRET)).toBe(user._id.toString());
      expect(await User.estimatedDocumentCount()).toBe(1);
    });

    it("should respond with a JWT and update a user in the database who does not have a google id", async () => {
      let user: userDocument | null = await User.create({
        email,
        password: "password",
      });
      const response: Response = await postGoogleLogin(validIdToken);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty("token");
      const token: string = response.body.user.token;
      expect(jwt.verify(token, JWT_SECRET)).toBe(user._id.toString());
      user = await User.findOne({ email });
      expect(user!.googleId).toBe(googleId);
      expect(await User.estimatedDocumentCount()).toBe(1);
    });
  });
});

describe("POST /validate", () => {
  function postValidate(id?: string): Test {
    const token = id ? jwt.sign(id, JWT_SECRET) : undefined;
    if (token) {
      return request(app).post("/auth/validate").set("Authorisation", token);
    }
    return request(app).post("/auth/validate");
  }

  it("should respond with a JWT if the token is valid", async () => {
    const user: userDocument | null = await User.create({
      email,
      password: "password",
    });
    console.assert(user);
    const id = user._id;
    const response: Response = await postValidate(id.toString());
    expect(response.status).toBe(200);
    expect(response.body.user).toHaveProperty("token");
    const token = response.body.user.token;
    expect(jwt.verify(token, JWT_SECRET)).toEqual(user.id.toString());
  });

  it("should respond with a 401 if the user id is not a valid user id", async () => {
    const response: Response = await postValidate("asdfsadf");
    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "This page requires you to be logged in."
    );
  });

  it("should respond with a 401 if no token is sent", async () => {
    const response: Response = await postValidate();
    expect(response.status).toBe(401);
    expect(response.body.message).toBe(
      "This page requires you to be logged in."
    );
  });
});
