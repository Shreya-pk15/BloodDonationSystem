const crypto = require("crypto");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../utils/jwtSecret");
const {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} = require("../services/emailService");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

// Register
const registerUser = async (req, res) => {
  try {
    const { name, username, email, phone, password, role, bloodGroup, city, lat, lng } =
      req.body;

    if (!name || !username || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (!lat || !lng) {
      return res.status(400).json({ message: "Location required" });
    }

    if (role === "donor" && !bloodGroup) {
      return res
        .status(400)
        .json({ message: "Blood group required for donors" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role,
      bloodGroup: role === "donor" ? bloodGroup : "",
      location: {
        city: city || "",
        lat,
        lng,
      },
    });

    await user.save();

    try {
      await sendWelcomeEmail(user);
    } catch (emailErr) {
      console.error("Welcome email failed:", emailErr.message);
    }

    res.status(201).json({ message: "Registered Successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Always respond with generic message to avoid email enumeration
    const genericMessage = "If an account with that email exists, a password reset link has been sent.";

    if (!user) {
      // Do not reveal that user was not found
      return res.status(200).json({ message: genericMessage });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 1000 * 60 * 60; // 1 hour
    await user.save();

    await sendPasswordResetEmail(user, token);
    return res.status(200).json({ message: genericMessage });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: "Token and new password are required" });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Reset token is invalid or has expired." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Login
const loginUser = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    const loginInput = (emailOrUsername || "").toString().trim().toLowerCase();

    // Hardcoded Admin Login
    if (loginInput === "admin@admin.com" && password === "admin123") {
      const token = jwt.sign(
        { userId: "admin123", role: "admin" },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      return res.status(200).json({
        message: "Admin Login Successful",
        token,
        user: {
          id: "admin123",
          name: "System Administrator",
          role: "admin",
          email: "admin@admin.com",
        },
      });
    }

    const searchPattern = new RegExp(`^${escapeRegex(loginInput)}$`, "i");
    const user = await User.findOne({
      $or: [{ email: searchPattern }, { username: searchPattern }],
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked. Please contact admin." });
    }

    if (user.role === "hospital" && !user.isVerified) {
      return res.status(403).json({ message: "Your hospital account is pending admin verification." });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login Successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        bloodGroup: user.bloodGroup,
        location: user.location,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
};