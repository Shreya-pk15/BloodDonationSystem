const Request = require("../models/Request");
const User = require("../models/User");

const ADMIN_ID = "admin123";

function participantKey(id1, id2) {
  return [id1, id2].sort().join(":");
}

async function getUserRole(userId) {
  if (userId === ADMIN_ID) return "admin";
  const user = await User.findById(userId).select("role");
  return user?.role || null;
}

async function hasDonorHospitalLink(donorId, hospitalId) {
  const link = await Request.findOne({
    hospitalId,
    acceptedDonors: donorId,
  }).select("_id");
  return !!link;
}

/**
 * Returns { allowed: boolean, message?: string }
 */
async function canUsersChat(senderId, recipientId) {
  if (!senderId || !recipientId || senderId === recipientId) {
    return { allowed: false, message: "Invalid chat participants" };
  }

  if (senderId === ADMIN_ID || recipientId === ADMIN_ID) {
    return { allowed: true };
  }

  const senderRole = await getUserRole(senderId);
  const recipientRole = await getUserRole(recipientId);

  if (!senderRole || !recipientRole) {
    return { allowed: false, message: "User not found" };
  }

  const pair = new Set([senderRole, recipientRole]);
  if (pair.has("admin")) {
    return { allowed: true };
  }

  if (pair.has("donor") && pair.has("hospital")) {
    const donorId = senderRole === "donor" ? senderId : recipientId;
    const hospitalId = senderRole === "hospital" ? senderId : recipientId;
    const linked = await hasDonorHospitalLink(donorId, hospitalId);
    if (linked) return { allowed: true };
    return {
      allowed: false,
      message:
        "You can message this hospital/donor only after a donation request is accepted",
    };
  }

  return {
    allowed: false,
    message: "Chat is only available between donors, hospitals, and admin",
  };
}

module.exports = {
  ADMIN_ID,
  participantKey,
  canUsersChat,
  hasDonorHospitalLink,
  getUserRole,
};
