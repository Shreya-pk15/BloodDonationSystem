const express = require("express");
const router = express.Router();

const { registerUser, loginUser, forgotPassword, resetPassword } = require("../controllers/authController");
const { authRateLimiter } = require("../middleware/rateLimiter");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password", authRateLimiter, resetPassword);

module.exports = router;