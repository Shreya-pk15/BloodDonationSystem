const User = require("../models/User");

const donorMiddleware = async (req, res, next) => {
  try {
    if (req.user.role !== "donor") {
      return res.status(403).json({ message: "Access denied. Donor account required." });
    }

    const user = await User.findById(req.user.userId);
    if (!user || user.role !== "donor") {
      return res.status(403).json({ message: "Access denied. Donor account required." });
    }

    req.donor = user;
    next();
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = donorMiddleware;
