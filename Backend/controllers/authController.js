const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../utils/jwtSecret");

// Register
const registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, bloodGroup, city, lat, lng } =
      req.body;

    if (!name || !email || !phone || !password || !role) {
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

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
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

    res.status(201).json({ message: "Registered Successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};

// Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Hardcoded Admin Login
    if (email === "admin@admin.com" && password === "admin123") {
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

    const user = await User.findOne({ email });
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

module.exports = { registerUser, loginUser };