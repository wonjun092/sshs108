import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const englishQuizScoreSchema = new Schema(
  {
    userId: { type: String, required: true, trim: true },
    loginId: { type: String, required: true, trim: true },
    book: {
      type: String,
      enum: ["wednesdayWars"],
      required: true,
    },
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 1 },
    achievedAt: { type: Date, default: Date.now, required: true },
    speedrunDurationMs: { type: Number, min: 1 },
    speedrunAchievedAt: { type: Date },
  },
  { timestamps: true },
);

englishQuizScoreSchema.index({ userId: 1, book: 1 }, { unique: true });
englishQuizScoreSchema.index({ book: 1, score: -1, achievedAt: 1 });
englishQuizScoreSchema.index({ book: 1, speedrunDurationMs: 1, speedrunAchievedAt: 1 });

export type EnglishQuizScoreDocument = InferSchemaType<
  typeof englishQuizScoreSchema
>;

export const EnglishQuizScore =
  (models.EnglishQuizScore as Model<EnglishQuizScoreDocument> | undefined) ??
  model<EnglishQuizScoreDocument>("EnglishQuizScore", englishQuizScoreSchema);
