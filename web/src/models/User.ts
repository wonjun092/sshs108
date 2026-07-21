import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    loginId: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "teacher", "student"], default: "student", required: true },
    status: { type: String, enum: ["pending", "active", "rejected"], default: "pending", required: true },
    studentId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    birthDate: { type: String, trim: true },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User =
  (models.User as Model<UserDocument> | undefined) ?? model<UserDocument>("User", userSchema);
