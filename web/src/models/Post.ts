import { InferSchemaType, Model, Schema, model, models } from "mongoose";

export const BOARD_TYPES = ["notice", "free", "anonymous", "lost-owner", "lost-item"] as const;

const commentSchema = new Schema(
  {
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    writer: { type: String, required: true },
    content: { type: String, required: true, trim: true, maxlength: 2_000 },
    legacyTime: { type: String, trim: true },
  },
  { timestamps: true },
);

const postSchema = new Schema(
  {
    board: { type: String, enum: BOARD_TYPES, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorLoginId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 20_000 },
    location: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    found: { type: Boolean, default: false },
    scheduledAt: { type: Date },
    views: { type: Number, default: 0, min: 0 },
    comments: { type: [commentSchema], default: [] },
    legacyIndex: { type: Number },
  },
  { timestamps: true },
);

postSchema.index({ board: 1, createdAt: -1 });
export type PostDocument = InferSchemaType<typeof postSchema>;
export const Post =
  (models.Post as Model<PostDocument> | undefined) ?? model<PostDocument>("Post", postSchema);
