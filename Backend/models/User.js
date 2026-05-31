const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    phone: { type: String, required: true },

    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["donor", "hospital", "admin"],
      default: "donor",
    },

    // Moderation & Trust Flags
    isBlocked: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false }, // Only relevant for Hospitals

    // NEW FIELD
    profilePhoto: { type: String, default: "" },

    bloodGroup: { type: String, default: "" },

    location: {
      city: { type: String, default: "" },
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
    },

    availability: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
    },

    lastDonationDate: { type: Date, default: null },

    donationHistory: [
      {
        requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request" },
        hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        bloodGroup: String,
        units: Number,
        donatedAt: Date,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);