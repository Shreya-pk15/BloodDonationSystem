const User = require("../models/User");
const Request = require("../models/Request");
const Report = require("../models/Report");
const {
  sendVerificationEmail,
  sendRejectionEmail,
  sendAccountBlockedEmail,
  sendAccountUnblockedEmail,
} = require("../services/emailService");

const getAnalytics = async (req, res) => {
  try {
    const totalDonors = await User.countDocuments({ role: "donor" });
    const totalHospitals = await User.countDocuments({ role: "hospital" });
    
    const requests = await Request.find();
    const totalRequests = requests.length;
    const completedRequests = requests.filter(r => r.status === "completed" || r.status === "fulfilled").length;

    // Calculate most requested blood group
    const bgMap = {};
    requests.forEach(r => {
      bgMap[r.bloodGroup] = (bgMap[r.bloodGroup] || 0) + 1;
    });

    let mostRequestedBg = "None";
    let maxCount = 0;
    for (const bg in bgMap) {
      if (bgMap[bg] > maxCount) {
        maxCount = bgMap[bg];
        mostRequestedBg = bg;
      }
    }

    res.status(200).json({
      totalDonors,
      totalHospitals,
      totalRequests,
      completedRequests,
      mostRequestedBloodGroup: mostRequestedBg
    });

  } catch (err) {
    res.status(500).json({ message: "Analytics fetch failed", error: err.message });
  }
};

// Users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } }).select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isBlocked = !user.isBlocked;
    // Reset verify if blocked? No, let them be independent.
    await user.save();
    try {
      if (user.isBlocked) await sendAccountBlockedEmail(user);
      else await sendAccountUnblockedEmail(user);
    } catch (emailErr) {
      console.error("Block/unblock email failed:", emailErr.message);
    }
    res.status(200).json({ message: `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const toggleVerifyHospital = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "hospital") return res.status(404).json({ message: "Hospital not found" });

    user.isVerified = !user.isVerified;
    await user.save();

    if (user.isVerified) {
      try {
        await sendVerificationEmail(user);
      } catch (emailErr) {
        console.error("Verification email failed:", emailErr.message);
      }
    }

    res.status(200).json({ message: `Hospital ${user.isVerified ? "verified" : "unverified"} successfully`, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getPendingHospitals = async (req, res) => {
  try {
    const hospitals = await User.find({ role: "hospital", isVerified: false }).select("-password").sort({ createdAt: -1 });
    res.status(200).json(hospitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const approveHospital = async (req, res) => {
  try {
    const hospital = await User.findById(req.params.id);
    if (!hospital || hospital.role !== "hospital") {
      return res.status(404).json({ message: "Hospital not found" });
    }

    if (hospital.isVerified) {
      return res.status(400).json({ message: "Hospital is already approved" });
    }

    hospital.isVerified = true;
    await hospital.save();
    try {
      await sendVerificationEmail(hospital);
    } catch (emailErr) {
      console.error("Verification email failed:", emailErr.message);
    }
    res.status(200).json({ message: "Hospital approved successfully", hospital });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const rejectHospital = async (req, res) => {
  try {
    const hospital = await User.findOne({ _id: req.params.id, role: "hospital", isVerified: false });
    if (!hospital) {
      return res.status(404).json({ message: "Pending hospital not found or already reviewed" });
    }

    try {
      await sendRejectionEmail(hospital);
    } catch (emailErr) {
      console.error("Rejection email failed:", emailErr.message);
    }

    await hospital.deleteOne();
    res.status(200).json({ message: "Hospital registration rejected and removed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Requests
const getAllRequests = async (req, res) => {
  try {
    const requests = await Request.find()
      .populate("hospitalId", "name email isVerified")
      .populate("acceptedDonors", "name phone")
      .sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const forceDeleteRequest = async (req, res) => {
  try {
    await Request.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Request explicitly deleted by admin." });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Reports
const getReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("reportedBy", "name email role")
      .populate("targetId", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const resolveReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("reportedBy")
      .populate("targetId", "name role");
      
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (report.status !== "pending") {
      return res
        .status(400)
        .json({ message: "This report has already been reviewed" });
    }

    const newStatus = req.body.status || "resolved";
    if (!["resolved", "dismissed"].includes(newStatus)) {
      return res
        .status(400)
        .json({ message: "Status must be resolved or dismissed" });
    }

    report.status = newStatus;
    report.adminNotes = req.body.adminNotes || report.adminNotes;

    await report.save();
    console.log("Report Saved. Attempting socket notify...");

    // Notify the reporter via socket
    const io = req.app.get("io");
    if (io && report.reportedBy) {
      const room = report.reportedBy._id.toString();
      console.log("Emitting report-resolved to room:", room);
      io.to(room).emit("report-resolved", {
        reportId: report._id,
        status: report.status,
        adminNotes: report.adminNotes,
        targetName: report.targetId?.name || "the reported user",
        targetRole: report.targetId?.role || "user",
      });
    } else {
      console.log("Socket Emission Skipped. io available?", !!io, " reportedBy available?", !!report.reportedBy);
    }

    res.status(200).json({ message: "Report updated", report });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = {
  getAnalytics,
  getAllUsers,
  toggleBlockUser,
  toggleVerifyHospital,
  getPendingHospitals,
  approveHospital,
  rejectHospital,
  getAllRequests,
  forceDeleteRequest,
  getReports,
  resolveReport
};
