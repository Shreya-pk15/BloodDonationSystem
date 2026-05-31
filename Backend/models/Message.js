const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: { type: String, required: true },
    messageType: {
      type: String,
      enum: ["text", "location"],
      default: "text",
    },
    body: { type: String, default: "", trim: true, maxlength: 2000 },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      city: { type: String, default: "" },
      isLive: { type: Boolean, default: false },
    },
    readBy: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
