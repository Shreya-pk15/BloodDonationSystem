const User = require("../models/User");

const adminMiddleware = async (req, res, next) => {
  try {
    // Check for hardcoded admin
    if (req.user.role === "admin" && req.user.userId === "admin123") {
      return next();
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied. Administrative privileges required." });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = adminMiddleware;
