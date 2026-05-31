const cron = require("node-cron");
const Request = require("../models/Request");
const notifyDonors = require("../utils/notifyDonors");
const { emitHospitalRequestEvent } = require("../services/requestService");

// CRON JOB — runs every minute
const startBroadcastCron = (io) => {
  cron.schedule("*/1 * * * *", async () => {
    try {
      const now = new Date();

      // Fetch all requests that are open or fulfilled (not completed/cancelled)
      const activeRequests = await Request.find({
        status: { $in: ["open", "fulfilled"] },
      });

      for (let reqObj of activeRequests) {

        // ── AUTO-FULFIL: if enough donors have accepted ──────────────────────
        if (
          reqObj.status === "open" &&
          reqObj.acceptedDonors.length >= reqObj.units
        ) {
          reqObj.status = "fulfilled";
          reqObj.broadcastStatus = "stopped";
          await reqObj.save();
          emitHospitalRequestEvent(io, reqObj.hospitalId, "request-fulfilled", {
            requestId: reqObj._id,
            acceptedCount: reqObj.acceptedDonors.length,
            units: reqObj.units,
            status: reqObj.status,
          });
          console.log("Request auto-fulfilled:", reqObj._id);
          continue;
        }

        // ── STOP BROADCAST after 2-hour window (never expire the request) ───
        if (
          reqObj.broadcastStatus === "active" &&
          reqObj.expiresAt &&
          now > reqObj.expiresAt
        ) {
          reqObj.broadcastStatus = "stopped";
          await reqObj.save();
          console.log("Broadcast stopped (window closed):", reqObj._id);
          continue;
        }

        // ── ESCALATION: only while broadcast is active ────────────────────────
        if (reqObj.broadcastStatus !== "active") continue;

        const createdAt = new Date(reqObj.createdAt);
        const diffMinutes = Math.floor((now - createdAt) / 60000);

        if (diffMinutes >= 5 && reqObj.broadcastStage === "3km") {
          reqObj.broadcastStage = "10km";
          reqObj.broadcastRadius = 10;
          await reqObj.save();
          console.log("Escalated to 10km:", reqObj._id);
          await notifyDonors(reqObj, io, { availability: ["available"] });
        }

        if (diffMinutes >= 10 && reqObj.broadcastStage === "10km") {
          reqObj.broadcastStage = "city";
          reqObj.broadcastRadius = 999;
          await reqObj.save();
          console.log("Escalated to city:", reqObj._id);
          await notifyDonors(reqObj, io, { availability: ["available"] });
        }
      }
    } catch (error) {
      console.log("Broadcast Cron Error:", error.message);
    }
  });
};

module.exports = startBroadcastCron;