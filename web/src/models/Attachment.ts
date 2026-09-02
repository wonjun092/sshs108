import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const attachmentSchema = new Schema(
  {
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export type AttachmentDocument = InferSchemaType<typeof attachmentSchema>;
export const Attachment =
  (models.Attachment as Model<AttachmentDocument> | undefined) ??
  model<AttachmentDocument>("Attachment", attachmentSchema);
