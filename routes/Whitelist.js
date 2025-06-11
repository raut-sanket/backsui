const express = require("express");
const { body, validationResult } = require("express-validator");
const Whitelist = require("../models/whitelist");
const Investment = require("../models/investment");
const PresaleConfig = require("../models/presaleConfig");
const auth = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/whitelist/check/:address
// @desc    Check wallet eligibility for current phase
// @access  Public
router.get("/check/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const walletAddress = address.toLowerCase();
  
      // Get current presale config
      const config = await PresaleConfig.findOne();
      if (!config) {
        return res.status(500).json({
          status: "error",
          message: "Presale configuration not found",
        });
      }
  
      // Get current phase based on time
      const currentPhase = config.getCurrentPhase();
  
      // Check if address is whitelisted
      const whitelistEntry = await Whitelist.findOne({
        walletAddress,
        isActive: true,
      });
  
      // FIXED: Always set the actual whitelist type first
      let whitelistType = whitelistEntry ? whitelistEntry.type : "none";
      let eligible = false;
  
      // Determine eligibility based on current phase and whitelist status
      if (currentPhase === "public") {
        // Public phase - everyone can participate
        eligible = true;
      } else if (currentPhase === "guaranteed") {
        // Guaranteed phase - only guaranteed addresses can invest
        eligible = whitelistEntry && whitelistEntry.type === "guaranteed";
      } else if (currentPhase === "waitlist") {
        // Waitlist phase - both guaranteed and waitlist addresses can invest
        eligible = whitelistEntry && (whitelistEntry.type === "guaranteed" || whitelistEntry.type === "waitlist");
      }
  
      // Get current investment amount
      const investmentStats = await Investment.aggregate([
        {
          $match: {
            walletAddress,
            status: "confirmed",
          },
        },
        {
          $group: {
            _id: null,
            totalInvested: { $sum: "$usdcAmount" },
            totalInvestments: { $sum: 1 },
          },
        },
      ]);
  
      const currentInvestment = investmentStats[0]?.totalInvested || 0;
      const totalInvestments = investmentStats[0]?.totalInvestments || 0;
  
      res.json({
        status: "success",
        data: {
          eligible,
          whitelistType, // This will now correctly show "waitlist" even during guaranteed phase
          currentPhase,
          currentInvestment,
          totalInvestments,
          isWhitelisted: !!whitelistEntry,
        },
      });
    } catch (error) {
      console.error("Whitelist check error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to check whitelist status",
      });
    }
  });

// @route   GET /api/v1/whitelist
// @desc    Get whitelist entries (Admin)
// @access  Private (Admin)
router.get("/", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";
    if (req.query.search) {
      filter.$or = [
        { walletAddress: { $regex: req.query.search, $options: "i" } },
        { notes: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const whitelist = await Whitelist.find(filter)
      .populate("addedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Whitelist.countDocuments(filter);

    // Get stats
    const stats = await Whitelist.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          active: { $sum: { $cond: ["$isActive", 1, 0] } },
        },
      },
    ]);

    const statsFormatted = {
      guaranteed: { count: 0, active: 0 },
      waitlist: { count: 0, active: 0 },
      total: { count: 0, active: 0 },
    };

    stats.forEach((stat) => {
      statsFormatted[stat._id] = stat;
      statsFormatted.total.count += stat.count;
      statsFormatted.total.active += stat.active;
    });

    res.json({
      status: "success",
      data: {
        whitelist,
        stats: statsFormatted,
      },
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get whitelist error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get whitelist",
    });
  }
});

// @route   POST /api/v1/whitelist/bulk-import
// @desc    Bulk import whitelist
// @access  Private (Admin)
router.post(
  "/bulk-import",
  auth,
  [
    body("whitelist").isArray().withMessage("Whitelist must be an array"),
    body("whitelist.*.walletAddress").isString().notEmpty(),
    body("whitelist.*.type").isIn(["guaranteed", "waitlist"]),
  ],
  async (req, res) => {
    try {
      errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: "error",
          message: "Invalid input",
          errors: errors.array(),
        });
      }

      const { whitelist } = req.body;
      let imported = 0;
      let updated = 0;
      let errors = [];

      for (const entry of whitelist) {
        try {
          const existingEntry = await Whitelist.findOne({
            walletAddress: entry.walletAddress.toLowerCase(),
          });

          if (existingEntry) {
            // Update existing entry
            existingEntry.type = entry.type;
            existingEntry.notes = entry.notes || existingEntry.notes;
            existingEntry.isActive =
              entry.isActive !== undefined
                ? entry.isActive
                : existingEntry.isActive;
            await existingEntry.save();
            updated++;
          } else {
            // Create new entry
            await Whitelist.create({
              walletAddress: entry.walletAddress.toLowerCase(),
              type: entry.type,
              notes: entry.notes,
              isActive: entry.isActive !== undefined ? entry.isActive : true,
              addedBy: req.user._id,
            });
            imported++;
          }
        } catch (error) {
          errors.push({
            walletAddress: entry.walletAddress,
            error: error.message,
          });
        }
      }

      res.json({
        status: "success",
        data: {
          imported,
          updated,
          errors,
        },
      });
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to import whitelist",
      });
    }
  }
);

// @route   POST /api/v1/whitelist/add
// @desc    Add single whitelist entry
// @access  Private (Admin)
router.post(
  "/add",
  auth,
  [
    body("walletAddress").isString().notEmpty(),
    body("type").isIn(["guaranteed", "waitlist"]),
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

      const { walletAddress, type, notes } = req.body;

      const entry = await Whitelist.findOneAndUpdate(
        { walletAddress: walletAddress.toLowerCase() },
        {
          walletAddress: walletAddress.toLowerCase(),
          type,
          notes,
          isActive: true,
          addedBy: req.user._id,
        },
        { upsert: true, new: true }
      );

      res.json({
        status: "success",
        data: entry,
      });
    } catch (error) {
      console.error("Add whitelist error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to add whitelist entry",
      });
    }
  }
);

// @route   DELETE /api/v1/whitelist/:id
// @desc    Delete whitelist entry
// @access  Private (Admin)
router.delete("/:id", auth, async (req, res) => {
  try {
    const entry = await Whitelist.findByIdAndDelete(req.params.id);

    if (!entry) {
      return res.status(404).json({
        status: "error",
        message: "Whitelist entry not found",
      });
    }

    res.json({
      status: "success",
      message: "Whitelist entry deleted successfully",
    });
  } catch (error) {
    console.error("Delete whitelist error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to delete whitelist entry",
    });
  }
});

module.exports = router;
