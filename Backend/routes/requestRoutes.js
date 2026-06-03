const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const hospitalMiddleware = require("../middleware/hospitalMiddleware");
const donorMiddleware = require("../middleware/donorMiddleware");

const {
  createRequest,
  getRequests,
  acceptRequest,
  declineRequest,
  getHospitalRequests,
  getRequestById,
  completeRequest,
  deleteRequest,
  editRequest,
  updateDonorProgress,
  cancelRequest,
  extendBroadcast,
} = require("../controllers/requestController");

// Hospital endpoints
router.post("/create", authMiddleware, hospitalMiddleware, createRequest);
router.get("/hospital/my", authMiddleware, hospitalMiddleware, getHospitalRequests);
router.get("/:id", authMiddleware, hospitalMiddleware, getRequestById);
router.post("/complete/:id", authMiddleware, hospitalMiddleware, completeRequest);
router.put("/cancel/:id", authMiddleware, hospitalMiddleware, cancelRequest);
router.post("/extend-broadcast/:id", authMiddleware, hospitalMiddleware, extendBroadcast);
router.delete("/delete/:id", authMiddleware, hospitalMiddleware, deleteRequest);
router.put("/donor-progress", authMiddleware, hospitalMiddleware, updateDonorProgress);
router.put("/:id", authMiddleware, hospitalMiddleware, editRequest);

// Donor endpoints
router.get("/", authMiddleware, donorMiddleware, getRequests);
router.post("/accept/:id", authMiddleware, donorMiddleware, acceptRequest);
router.post("/decline/:id", authMiddleware, donorMiddleware, declineRequest);

module.exports = router;
