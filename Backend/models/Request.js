const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    bloodGroup: { type: String, required: true },

    units: { type: Number, required: true },

    urgency: {
      type: String,
      enum: ["normal", "urgent", "critical"],
      default: "normal",
    },

    location: {
      city: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    status: {
      type: String,
      enum: ["open", "fulfilled", "completed", "cancelled"],
      default: "open",
    },

    broadcastStatus: {
      type: String,
      enum: ["active", "stopped"],
      default: "active",
    },

    acceptedDonors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    broadcastStage: {
      type: String,
      enum: ["3km", "10km", "city"],
      default: "3km",
    },

    broadcastRadius: {
      type: Number,
      default: 3,
    },

    broadcastDurationHours: {
      type: Number,
      default: 2,
      min: 1,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    // Module 4: per-donor status tracking
    donorProgress: [
      {
        donorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: ["accepted", "reached", "donated"],
          default: "accepted",
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);