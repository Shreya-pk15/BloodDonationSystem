const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
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
} = require("../controllers/userController");

router.get("/me", authMiddleware, getMe);
router.get("/profile", authMiddleware, getMe);
router.get("/donor/history", authMiddleware, getDonationHistory);
router.get("/eligibility", authMiddleware, getDonorEligibility);
router.put("/profile", authMiddleware, updateProfile);
router.put("/location", authMiddleware, updateLocation);
router.put("/availability", authMiddleware, updateAvailability);
router.put("/change-password", authMiddleware, changePassword);
router.post("/report", authMiddleware, submitReport);
router.get("/my-reports", authMiddleware, getMyReports);
router.delete("/reports/:id", authMiddleware, deleteMyReport);

module.exports = router;