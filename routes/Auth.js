const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/user");
const auth = require("../middleware/auth");

const router = express.Router();

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// @route   POST /api/v1/auth/login
// @desc    Admin login
// @access  Public
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          message: "Invalid input",
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user || !user.isActive) {
        return res.status(401).json({
          status: "error",
          message: "Invalid credentials",
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          status: "error",
          message: "Invalid credentials",
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      const token = generateToken(user._id);

      res.json({
        status: "success",
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        status: "error",
        message: "Server error",
      });
    }
  }
);

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", auth, async (req, res) => {
  res.json({
    status: "success",
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        lastLogin: req.user.lastLogin,
      },
    },
  });
});

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", auth, async (req, res) => {
  res.json({
    status: "success",
    message: "Logged out successfully",
  });
});

module.exports = router;
