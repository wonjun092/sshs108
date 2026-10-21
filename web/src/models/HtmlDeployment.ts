import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const schema = new Schema({
  // MongoDB always creates a unique _id index, even with autoIndex disabled.
  // A single insert claims the path and stores its HTML atomically.
  _id: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  filename: { type: String, required: true },
  html: { type: String, required: true, select: false },
  size: { type: Number, required: true },
  revision: { type: String, required: true },
}, { timestamps: true });

export type HtmlDeploymentDocument = InferSchemaType<typeof schema>;
export const HtmlDeployment = (models.HtmlDeployment as Model<HtmlDeploymentDocument> | undefined)
  ?? model<HtmlDeploymentDocument>("HtmlDeployment", schema);
