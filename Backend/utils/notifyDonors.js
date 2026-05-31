const User = require("../models/User");
const { getDistanceInKm } = require("./distance");
const { getCompatibleDonorGroups } = require("./bloodCompatibility");

/**
 * Notify donors whose blood type is compatible with the hospital request.
 */
const notifyDonors = async (reqObj, io, options = {}) => {
  // Do not send notifications if the broadcast window has been stopped
  if (reqObj.broadcastStatus === "stopped") {
    console.log(`Broadcast stopped for request ${reqObj._id}, skipping notification.`);
    return 0;
  }

  const availability = options.availability ?? ["available", "busy"];
  const compatibleGroups = getCompatibleDonorGroups(reqObj.bloodGroup);

  if (compatibleGroups.length === 0) {
    console.log(
      `No compatible donor groups for recipient type ${reqObj.bloodGroup}`
    );
    return 0;
  }

  // Fetch compatible donors
  const donors = await User.find({
    role: "donor",
    bloodGroup: { $in: compatibleGroups },
  });

  let filteredDonors = donors.filter((d) => {
    // 1. Availability check: default to "available" if not set in DB
    const status = d.availability || "available";
    if (status === "offline") return false;
    if (status === "busy" && reqObj.urgency !== "critical") return false;

    // 2. Location matching check
    if (reqObj.broadcastStage === "city") {
      return (
        d.location?.city &&
        reqObj.location?.city &&
        d.location.city.toLowerCase() === reqObj.location.city.toLowerCase()
      );
    } else {
      // For radius broadcast stages, lat/lng coordinates must be valid
      if (!d.location?.lat || !d.location?.lng) return false;

      const dist = getDistanceInKm(
        reqObj.location.lat,
        reqObj.location.lng,
        d.location.lat,
        d.location.lng
      );
      return dist <= reqObj.broadcastRadius;
    }
  });

  filteredDonors.forEach((donor) => {
    io.to(donor._id.toString()).emit("new-request", reqObj);
  });

  console.log(
    `Broadcast: ${filteredDonors.length} donor(s) notified for ${reqObj.bloodGroup} ` +
    `(compatible donor types: ${compatibleGroups.join(", ")})`
  );

  return filteredDonors.length;
};

module.exports = notifyDonors;
