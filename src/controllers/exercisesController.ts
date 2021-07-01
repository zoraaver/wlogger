import { Request, Response } from "express";
import { ResponseError } from "../../@types";
import { Exercise, exerciseDocument } from "../models/exercise";
import { userDocument } from "../models/user";

export async function create(
  req: Request<any, any, { notes?: string; name: string }>,
  res: Response<exerciseDocument | ResponseError>
): Promise<void> {
  try {
    const user = req.currentUser as userDocument;
    await user.populate("exercises", "name").execPopulate();

    const exerciseNameAlreadyTaken = user.exercises
      .map((exercise) => exercise.name)
      .includes(req.body.name);

    if (exerciseNameAlreadyTaken) {
      throw new Error("Validation error: name: Name is already taken");
    }

    const exercise: exerciseDocument = await Exercise.create(req.body);

    user.exercises.unshift(exercise._id);
    await user.save();

    res.status(201).json(exercise);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}

export async function index(
  req: Request,
  res: Response<exerciseDocument[]>
): Promise<void> {
  const user = req.currentUser as userDocument;

  await user
    .populate({ path: "exercises", options: { sort: { name: 1 } } })
    .execPopulate();

  res.json(user.exercises);
}

export async function destroy(
  req: Request<{ id: string }>,
  res: Response<string>
): Promise<void> {
  const { id } = req.params;
  const user = req.currentUser as userDocument;

  const exerciseIndex: number | undefined = user.exercises.findIndex(
    (exercise: exerciseDocument) => exercise.toString() === id
  );

  user.exercises.splice(exerciseIndex, 1);

  await Promise.all([user.save(), Exercise.findByIdAndDelete(id)]);

  res.json(id);
}

export async function update(
  req: Request<{ id: string }>,
  res: Response<exerciseDocument | ResponseError>
): Promise<void> {
  const { id } = req.params;
  try {
    const exercise: exerciseDocument | null = await Exercise.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (exercise) res.json(exercise);
  } catch (error) {
    const [, field, message]: string[] = error.message.split(": ");
    res.status(406).json({ field, error: message });
  }
}
