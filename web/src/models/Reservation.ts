import { InferSchemaType, Model, Schema, model, models } from "mongoose";

const reservationSchema = new Schema(
  {
    date: { type: String, required: true, index: true },
    studentId: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    period: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["scheduled", "applied", "cancelled", "failed"], default: "scheduled" },
  },
  { timestamps: true },
);

reservationSchema.index({ date: 1, studentId: 1, period: 1, location: 1 }, { unique: true });
export type ReservationDocument = InferSchemaType<typeof reservationSchema>;
export const Reservation =
  (models.Reservation as Model<ReservationDocument> | undefined) ??
  model<ReservationDocument>("Reservation", reservationSchema);
