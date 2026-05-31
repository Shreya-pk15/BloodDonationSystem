const User = require("../models/User");

const hospitalMiddleware = async (req, res, next) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({ message: "Access denied. Hospital account required." });
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== "hospital") {
      return res.status(403).json({ message: "Access denied. Hospital account required." });
    }

    req.hospital = user;
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = hospitalMiddleware;
