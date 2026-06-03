const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const {
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
  resolveReport,
} = require("../controllers/adminController");

// All admin routes are protected
router.use(authMiddleware, adminMiddleware);

// Analytics
router.get("/analytics", getAnalytics);

// Users & Hospitals
router.get("/users", getAllUsers);
router.get("/hospitals/pending", getPendingHospitals);
router.put("/hospitals/:id/approve", approveHospital);
router.delete("/hospitals/:id/reject", rejectHospital);
router.put("/users/:id/block", toggleBlockUser);
router.put("/users/:id/verify", toggleVerifyHospital);

// Requests
router.get("/requests", getAllRequests);
router.delete("/requests/:id", forceDeleteRequest);

// Reports
router.get("/reports", getReports);
router.put("/reports/:id/resolve", resolveReport);

module.exports = router;
