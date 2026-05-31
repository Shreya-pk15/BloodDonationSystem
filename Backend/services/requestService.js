const Request = require("../models/Request");
const User = require("../models/User");

const DONOR_POPULATE_FIELDS = "name email phone availability bloodGroup";
const COOLDOWN_DAYS = 90;

/**
 * Shared helpers for request lifecycle.
 * Extension points for future modules: chat, notifications, AI demand, escalation.
 */

const buildHospitalSummary = (requests) => ({
  total: requests.length,
  open: requests.filter((r) => r.status === "open").length,
  fulfilled: requests.filter((r) => r.status === "fulfilled").length,
  completed: requests.filter((r) => r.status === "completed").length,
  cancelled: requests.filter((r) => r.status === "cancelled").length,
});

const populateHospitalRequest = (query) =>
  query.populate("acceptedDonors", DONOR_POPULATE_FIELDS);

const assertHospitalOwnership = (request, hospitalId) => {
  if (!request) {
    return { ok: false, status: 404, message: "Request not found" };
  }
  if (request.hospitalId.toString() !== hospitalId) {
    return { ok: false, status: 403, message: "Access denied" };
  }
  return { ok: true };
};

const assertEditableStatus = (status) => {
  if (["fulfilled", "completed", "cancelled"].includes(status)) {
    return {
      ok: false,
      status: 400,
      message: "Cannot edit a fulfilled, completed, or cancelled request",
    };
  }
  return { ok: true };
};

const getDonorCooldownRemaining = (lastDonationDate) => {
  if (!lastDonationDate) return { blocked: false, remainingDays: 0 };

  const diffDays =
    (new Date() - new Date(lastDonationDate)) / (1000 * 60 * 60 * 24);

  if (diffDays < COOLDOWN_DAYS) {
    return { blocked: true, remainingDays: Math.ceil(COOLDOWN_DAYS - diffDays) };
  }

  return { blocked: false, remainingDays: 0 };
};

const applyDonationCompletion = async (request) => {
  const now = new Date();

  for (const donorId of request.acceptedDonors) {
    await User.findByIdAndUpdate(donorId, {
      lastDonationDate: now,
      $push: {
        donationHistory: {
          requestId: request._id,
          hospitalId: request.hospitalId,
          bloodGroup: request.bloodGroup,
          units: 1,
          donatedAt: now,
        },
      },
    });
  }

  return now;
};

const emitHospitalRequestEvent = (io, hospitalId, event, payload) => {
  if (!io) return;
  io.to(hospitalId.toString()).emit(event, payload);
};

const emitDonorRequestEvent = (io, donorIds, event, payload) => {
  if (!io) return;
  donorIds.forEach((donorId) => {
    io.to(donorId.toString()).emit(event, payload);
  });
};

module.exports = {
  DONOR_POPULATE_FIELDS,
  COOLDOWN_DAYS,
  buildHospitalSummary,
  populateHospitalRequest,
  assertHospitalOwnership,
  assertEditableStatus,
  getDonorCooldownRemaining,
  applyDonationCompletion,
  emitHospitalRequestEvent,
  emitDonorRequestEvent,
};
