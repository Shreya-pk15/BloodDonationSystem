const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participantKey: {
      type: String,
      required: true,
      unique: true,
    },
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length === 2,
        message: "Conversation must have exactly two participants",
      },
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Request",
      default: null,
    },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
