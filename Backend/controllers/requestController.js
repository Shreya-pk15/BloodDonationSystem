const Request = require("../models/Request");
const User = require("../models/User");
const notifyDonors = require("../utils/notifyDonors");
const {
  canDonateTo,
  getRecipientGroupsForDonor,
} = require("../utils/bloodCompatibility");
const {
  buildHospitalSummary,
  populateHospitalRequest,
  assertHospitalOwnership,
  assertEditableStatus,
  getDonorCooldownRemaining,
  applyDonationCompletion,
  emitHospitalRequestEvent,
  emitDonorRequestEvent,
} = require("../services/requestService");
const { sendDonationCompletedEmail } = require("../services/emailService");

const ALLOWED_BROADCAST_HOURS = [1, 2, 4, 6, 12, 24];

// CREATE REQUEST (Hospital)
const createRequest = async (req, res) => {
  try {
    const { bloodGroup, units, urgency, customLocation, broadcastDuration } = req.body;

    if (!bloodGroup || units === undefined || units === null || !urgency) {
      return res.status(400).json({ message: "All fields required" });
    }

    const parsedUnits = Number(units);
    if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) {
      return res.status(400).json({ message: "Units must be greater than 0" });
    }

    const hospital = req.hospital || (await User.findById(req.user.userId));
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    if (!hospital.isVerified) {
      return res.status(403).json({ message: "Only verified hospitals can create requests" });
    }

    if (!hospital.location?.lat || !hospital.location?.lng) {
      return res.status(400).json({ message: "Hospital location not found" });
    }

    let broadcastHours = Number(broadcastDuration) || 2;
    if (!ALLOWED_BROADCAST_HOURS.includes(broadcastHours)) {
      broadcastHours = 2;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + broadcastHours);

    let finalLocation = {
      city: hospital.location.city,
      lat: hospital.location.lat,
      lng: hospital.location.lng,
    };

    if (customLocation?.city && customLocation?.lat && customLocation?.lng) {
      finalLocation = {
        city: customLocation.city,
        lat: customLocation.lat,
        lng: customLocation.lng,
      };
    }

    const newRequest = new Request({
      hospitalId: hospital._id,
      bloodGroup,
      units: parsedUnits,
      urgency,
      location: finalLocation,
      broadcastStage: "3km",
      broadcastRadius: 3,
      broadcastDurationHours: broadcastHours,
      expiresAt,
      status: "open",
      broadcastStatus: "active",
    });

    await newRequest.save();

    const io = req.app.get("io");
    await notifyDonors(newRequest, io);

    res.status(201).json({
      message: "Request created and broadcast started",
      request: newRequest,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET ALL OPEN REQUESTS (Donor)
const getRequests = async (req, res) => {
  try {
    const donor = req.donor || (await User.findById(req.user.userId));
    if (!donor) {
      return res.status(404).json({ message: "User not found" });
    }

    const { blocked, remainingDays } = getDonorCooldownRemaining(donor.lastDonationDate);

    const compatibleRecipientGroups = getRecipientGroupsForDonor(donor.bloodGroup);

    let query = {
      status: "open",
      bloodGroup: { $in: compatibleRecipientGroups },
    };

    if (donor.availability === "offline") {
      return res.status(200).json({
        requests: [],
        eligibility: { eligible: !blocked, remainingDays },
      });
    }

    if (donor.availability === "busy") {
      query.urgency = { $in: ["critical", "urgent"] };
    }

    const requests = await Request.find(query).populate(
      "hospitalId",
      "name phone email location"
    );

    res.status(200).json({
      requests,
      eligibility: { eligible: !blocked, remainingDays },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET HOSPITAL REQUESTS (Hospital Dashboard Tracking)
const getHospitalRequests = async (req, res) => {
  try {
    const hospitalId = req.user.userId;
    const { status } = req.query;

    const filter = { hospitalId };
    const validStatuses = ["open", "fulfilled", "completed", "cancelled"];
    if (status && status !== "all" && validStatuses.includes(status)) {
      filter.status = status;
    }

    const requests = await populateHospitalRequest(
      Request.find(filter).sort({ createdAt: -1 })
    );

    const allRequests = await Request.find({ hospitalId });
    const summary = buildHospitalSummary(allRequests);

    res.status(200).json({ requests, summary });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET SINGLE REQUEST (Hospital Request Details)
const getRequestById = async (req, res) => {
  try {
    const requestId = req.params.id;
    const hospitalId = req.user.userId;

    const request = await populateHospitalRequest(
      Request.findById(requestId)
    );

    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    const acceptedCount = request.acceptedDonors?.length || 0;

    res.status(200).json({
      request,
      meta: {
        acceptedCount,
        remainingUnits: Math.max(0, request.units - acceptedCount),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ACCEPT REQUEST (Donor)
const acceptRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const donor = req.donor || (await User.findById(req.user.userId));

    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }

    if (donor.availability === "offline") {
      return res.status(403).json({ message: "You must be online to accept requests" });
    }

    const cooldown = getDonorCooldownRemaining(donor.lastDonationDate);
    if (cooldown.blocked) {
      return res.status(400).json({
        message: `Blocked: wait ${cooldown.remainingDays} days`,
      });
    }

    const request = await Request.findOne({
      _id: requestId,
      status: "open",
      acceptedDonors: { $ne: donor._id },
      $expr: { $lt: [{ $size: "$acceptedDonors" }, "$units"] },
    });

    if (!request) {
      return res.status(400).json({ message: "Request not available" });
    }

    if (!canDonateTo(donor.bloodGroup, request.bloodGroup)) {
      return res.status(400).json({
        message: `Your blood group (${donor.bloodGroup}) cannot donate to ${request.bloodGroup}`,
      });
    }

    request.acceptedDonors.push(donor._id);
    request.donorProgress.push({ donorId: donor._id, status: "accepted" });

    const wasFulfilled = request.acceptedDonors.length >= request.units;
    if (wasFulfilled) {
      request.status = "fulfilled";
      request.broadcastStatus = "stopped";
    }

    await request.save();

    const io = req.app.get("io");
    const socketPayload = {
      requestId: request._id,
      acceptedCount: request.acceptedDonors.length,
      units: request.units,
      status: request.status,
      donorInfo: {
        _id: donor._id,
        name: donor.name,
        email: donor.email,
        phone: donor.phone,
        bloodGroup: donor.bloodGroup,
        availability: donor.availability,
      },
    };

    emitHospitalRequestEvent(io, request.hospitalId, "donor-accepted", socketPayload);

    if (wasFulfilled) {
      emitHospitalRequestEvent(io, request.hospitalId, "request-fulfilled", {
        requestId: request._id,
        acceptedCount: request.acceptedDonors.length,
        units: request.units,
        status: request.status,
      });
    }

    res.status(200).json({
      message: "Accepted successfully",
      acceptedCount: request.acceptedDonors.length,
      status: request.status,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const completeRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const hospitalId = req.user.userId;

    const request = await Request.findById(requestId);
    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    if (request.status !== "fulfilled") {
      return res.status(400).json({
        message: "Only fulfilled requests can be marked completed",
      });
    }

    request.status = "completed";
    request.broadcastStatus = "stopped";
    await request.save();

    await applyDonationCompletion(request);

    // Send donation completion emails to donors
    try {
      const donors = await User.find({ _id: { $in: request.acceptedDonors } });
      const hospital = await User.findById(request.hospitalId).select("name");
      const requestForEmail = { _id: request._id, hospitalId: hospital ? hospital.name : request.hospitalId };
      for (const donor of donors) {
        try {
          await sendDonationCompletedEmail(donor, requestForEmail);
        } catch (emailErr) {
          console.error("Donation completion email failed for donor", donor._id, emailErr.message);
        }
      }
    } catch (err) {
      console.error("Failed to send donation completion emails:", err.message);
    }

    const io = req.app.get("io");
    emitDonorRequestEvent(io, request.acceptedDonors, "donation-completed", {
      requestId: request._id,
      message: "Donation marked completed. You are now ineligible for 90 days.",
    });

    res.status(200).json({ message: "Request marked completed successfully", request });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const hospitalId = req.user.userId;

    const request = await Request.findById(requestId);
    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    if (request.status === "completed") {
      return res.status(400).json({ message: "Cannot delete a completed request" });
    }

    await Request.findByIdAndDelete(requestId);

    const io = req.app.get("io");
    emitDonorRequestEvent(io, request.acceptedDonors, "request-deleted", {
      requestId,
    });

    return res.status(200).json({ message: "Request deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const editRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const hospitalId = req.user.userId;
    const { units, urgency } = req.body;

    const request = await Request.findById(requestId);
    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    const editable = assertEditableStatus(request.status);
    if (!editable.ok) {
      return res.status(editable.status).json({ message: editable.message });
    }

    if (units !== undefined) {
      const parsedUnits = Number(units);
      if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) {
        return res.status(400).json({ message: "Units must be greater than 0" });
      }
      if (parsedUnits < request.acceptedDonors.length) {
        return res.status(400).json({
          message: `Units cannot be less than accepted donors (${request.acceptedDonors.length})`,
        });
      }
      request.units = parsedUnits;

      if (request.acceptedDonors.length >= request.units && request.status === "open") {
        request.status = "fulfilled";
        request.broadcastStatus = "stopped";
      }
    }

    if (urgency !== undefined) request.urgency = urgency;

    await request.save();

    const populated = await populateHospitalRequest(
      Request.findById(request._id)
    );

    res.status(200).json({ message: "Request updated", request: populated });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const updateDonorProgress = async (req, res) => {
  try {
    const { requestId, donorId, status } = req.body;
    const hospitalId = req.user.userId;

    if (!["accepted", "reached", "donated"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const request = await Request.findById(requestId);
    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    const existing = request.donorProgress.find(
      (p) => p.donorId.toString() === donorId
    );
    if (existing) {
      existing.status = status;
    } else {
      request.donorProgress.push({ donorId, status });
    }

    await request.save();

    const io = req.app.get("io");
    if (io) {
      io.to(donorId).emit("donor-status-update", { requestId, status });
    }

    res.status(200).json({
      message: "Donor progress updated",
      donorProgress: request.donorProgress,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const cancelRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const hospitalId = req.user.userId;

    const request = await Request.findById(requestId);
    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    if (request.status === "completed") {
      return res.status(400).json({ message: "Cannot cancel a completed request" });
    }

    if (request.status === "cancelled") {
      return res.status(400).json({ message: "Request is already cancelled" });
    }

    request.status = "cancelled";
    request.broadcastStatus = "stopped";
    await request.save();

    const io = req.app.get("io");
    emitDonorRequestEvent(io, request.acceptedDonors, "request-cancelled", {
      requestId: request._id,
      message: "A blood request you committed to has been cancelled by the hospital.",
    });

    emitHospitalRequestEvent(io, hospitalId, "request-cancelled", {
      requestId: request._id,
    });

    res.status(200).json({ message: "Request cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const extendBroadcast = async (req, res) => {
  try {
    const requestId = req.params.id;
    const hospitalId = req.user.userId;

    const request = await Request.findById(requestId);
    const ownership = assertHospitalOwnership(request, hospitalId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ message: ownership.message });
    }

    if (["completed", "cancelled", "fulfilled"].includes(request.status)) {
      return res.status(400).json({ message: "Cannot extend broadcast for this request" });
    }

    const base =
      request.expiresAt && request.expiresAt > new Date()
        ? request.expiresAt
        : new Date();
    const newExpiry = new Date(base);
    newExpiry.setHours(newExpiry.getHours() + (request.broadcastDurationHours || 2));

    request.expiresAt = newExpiry;
    request.broadcastStatus = "active";
    await request.save();

    const io = req.app.get("io");
    await notifyDonors(request, io);

    res.status(200).json({
      message: "Broadcast extended",
      expiresAt: request.expiresAt,
      broadcastStatus: request.broadcastStatus,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  createRequest,
  getRequests,
  acceptRequest,
  getHospitalRequests,
  getRequestById,
  completeRequest,
  deleteRequest,
  editRequest,
  updateDonorProgress,
  cancelRequest,
  extendBroadcast,
};
