const User = require("../models/User");
const Report = require("../models/Report");
const bcrypt = require("bcrypt");

const updateLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { city, lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and Longitude required" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        location: { city, lat, lng },
      },
      { new: true }
    );

    res.status(200).json({ message: "Location updated", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const updateAvailability = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { availability } = req.body;

    const validStates = ["available", "busy", "offline"];

    if (!validStates.includes(availability)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { availability },
      { new: true }
    );

    // 🔥 SOCKET EMIT (NEW)
    const io = req.app.get("io");
    if (io) {
      io.emit("availability-updated", {
        userId,
        availability: user.availability,
      });
    }

    res.status(200).json({
      message: "Availability updated",
      availability: user.availability,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId)
      .select("-password")
      .populate("donationHistory.hospitalId", "name email phone location");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, city, bloodGroup, profilePhoto } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (bloodGroup) user.bloodGroup = bloodGroup;
    if (profilePhoto) user.profilePhoto = profilePhoto;
    if (city) {
      if (!user.location) user.location = {};
      user.location.city = city;
    }

    await user.save();
    
    // strip out password just in case
    user.password = undefined;

    res.status(200).json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const submitReport = async (req, res) => {
  try {
    const { targetId, reason, requestId } = req.body;
    const reportedBy = req.user.userId;

    if (!targetId || !reason || !String(reason).trim()) {
      return res
        .status(400)
        .json({ message: "Target user and reason are required" });
    }

    const reporter = await User.findById(reportedBy);
    if (!reporter) {
      return res.status(404).json({ message: "Your account was not found" });
    }

    if (reporter.role !== "donor" && reporter.role !== "hospital") {
      return res
        .status(403)
        .json({ message: "Only donors and hospitals can submit reports" });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({ message: "Reported user not found" });
    }

    if (target._id.toString() === reportedBy.toString()) {
      return res.status(400).json({ message: "You cannot report yourself" });
    }

    if (reporter.role === "donor" && target.role !== "hospital") {
      return res
        .status(400)
        .json({ message: "Donors can only report hospitals" });
    }

    if (reporter.role === "hospital" && target.role !== "donor") {
      return res
        .status(400)
        .json({ message: "Hospitals can only report donors" });
    }

    const report = new Report({
      reportedBy,
      targetId,
      reason: String(reason).trim(),
      reporterRole: reporter.role,
      targetRole: target.role,
      requestId: requestId || undefined,
    });

    await report.save();

    const populated = await Report.findById(report._id)
      .populate("reportedBy", "name email role")
      .populate("targetId", "name email role");

    const io = req.app.get("io");
    if (io) {
      io.to("admin").emit("new-report", { report: populated });
    }

    res.status(201).json({
      message: "Report submitted. Admin will review it shortly.",
      report: populated,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getMyReports = async (req, res) => {
  try {
    const userId = req.user.userId;
    const reports = await Report.find({ reportedBy: userId })
      .populate("targetId", "name email role")
      .sort({ createdAt: -1 });
    res.status(200).json(reports);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteMyReport = async (req, res) => {
  try {
    const userId = req.user.userId;
    const reportId = req.params.id;
    const report = await Report.findOneAndDelete({ _id: reportId, reportedBy: userId });
    if (!report) return res.status(404).json({ message: "Report not found or logic error" });
    res.status(200).json({ message: "Report removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getDonationHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId)
      .select("donationHistory")
      .populate("donationHistory.hospitalId", "name email phone location");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const sortedHistory = user.donationHistory.sort((a, b) => new Date(b.donatedAt) - new Date(a.donatedAt));
    res.status(200).json(sortedHistory);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getDonorEligibility = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select("lastDonationDate donationHistory bloodGroup availability");
    if (!user) return res.status(404).json({ message: "User not found" });

    let canDonate = true;
    let remainingDays = 0;
    let daysSinceLast = null;

    if (user.lastDonationDate) {
      const diff = (new Date() - new Date(user.lastDonationDate)) / (1000 * 60 * 60 * 24);
      daysSinceLast = Math.floor(diff);
      if (diff < 90) {
        canDonate = false;
        remainingDays = Math.ceil(90 - diff);
      }
    }

    res.status(200).json({
      canDonate,
      remainingDays,
      daysSinceLast,
      lastDonationDate: user.lastDonationDate,
      totalDonations: user.donationHistory?.length || 0,
      bloodGroup: user.bloodGroup,
      availability: user.availability,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    console.log('🔒 changePassword called with body:', req.body, 'userId:', req.user?.userId);
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      console.warn('Missing password fields');
      return res.status(400).json({ message: "Current and new passwords are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn('User not found for id', userId);
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.warn('Incorrect current password for user', userId);
      return res.status(400).json({ message: "Incorrect current password" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    // Update password directly without triggering full document validation
    await User.findByIdAndUpdate(userId, { password: hashed }, { new: true, runValidators: false });
    console.log('✅ Password updated for user', userId, 'hashed:', hashed);

    // Fetch updated user (excluding password) for verification
    const updatedUser = await User.findById(userId).select('-password');
    res.status(200).json({ message: "Password updated successfully", user: updatedUser });
  } catch (err) {
    console.error('Error in changePassword:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  updateLocation,
  updateAvailability,
  getMe,
  updateProfile,
  submitReport,
  getMyReports,
  deleteMyReport,
  getDonationHistory,
  getDonorEligibility,
  changePassword,
};