import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    // One who is subscribing
    subscriber: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    // One who is being subscribed to
    channel: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
