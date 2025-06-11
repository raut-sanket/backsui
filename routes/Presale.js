const express = require("express");
const Investment = require("../models/investment");
const PresaleConfig = require("../models/presaleConfig");

const router = express.Router();

// @route   GET /api/v1/presale/stats
// @desc    Get presale statistics
// @access  Public
router.get("/stats", async (req, res) => {
  try {
    // Get presale config
    let config = await PresaleConfig.findOne();
    if (!config) {
      // Create default config if none exists
      config = new PresaleConfig();
      await config.save();
    }

    // Get current phase based on time
    const currentPhase = config.getCurrentPhase();

    // Calculate statistics
    const stats = await Investment.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: null,
          totalUSDC: { $sum: "$usdcAmount" },
          totalVictoryTokens: { $sum: "$victoryTokens.allocated" },
          totalInvestments: { $sum: 1 },
          uniqueInvestors: { $addToSet: "$walletAddress" },
        },
      },
    ]);

    const result = stats[0] || {
      totalUSDC: 0,
      totalVictoryTokens: 0,
      totalInvestments: 0,
      uniqueInvestors: [],
    };

    const progressPercentage = (result.totalUSDC / config.hardCapUSDC) * 100;

    // Get phase-specific stats
    const phaseStats = await Investment.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: "$presalePhase",
          totalUSDC: { $sum: "$usdcAmount" },
          totalInvestments: { $sum: 1 },
          uniqueInvestors: { $addToSet: "$walletAddress" },
        },
      },
    ]);

    const formattedPhaseStats = phaseStats.reduce((acc, stat) => {
      acc[stat._id] = {
        totalUSDC: stat.totalUSDC,
        totalInvestments: stat.totalInvestments,
        uniqueInvestors: stat.uniqueInvestors.length,
      };
      return acc;
    }, {});

    res.json({
      status: "success",
      data: {
        stats: {
          totalUSDC: result.totalUSDC,
          totalVictoryTokens: result.totalVictoryTokens,
          uniqueInvestors: result.uniqueInvestors.length,
          progressPercentage: Math.min(progressPercentage, 100),
          totalInvestments: result.totalInvestments,
        },
        phaseStats: formattedPhaseStats,
        config: {
          currentPhase,
          actualPhase: currentPhase, // What phase we're actually in based on time
          status: config.status,
          presaleRate: config.presaleRate,
          hardCapUSDC: config.hardCapUSDC,
          softCapUSDC: config.softCapUSDC,
          minInvestmentUSDC: config.minInvestmentUSDC,
          maxInvestmentUSDC: config.maxInvestmentUSDC,
          airdropPercentage: config.airdropPercentage,
          stakingPercentage: config.stakingPercentage,
          phases: {
            guaranteed: {
              startTime: config.phases.guaranteed.startTime,
              endTime: config.phases.guaranteed.endTime,
              active: currentPhase === "guaranteed",
            },
            waitlist: {
              startTime: config.phases.waitlist.startTime,
              endTime: config.phases.waitlist.endTime,
              active: currentPhase === "waitlist",
            },
            public: {
              startTime: config.phases.public.startTime,
              endTime: config.phases.public.endTime,
              active: currentPhase === "public",
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Presale stats error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get presale statistics",
    });
  }
});

// @route   GET /api/v1/presale/phase
// @desc    Get current phase information
// @access  Public
router.get("/phase", async (req, res) => {
  try {
    const config = await PresaleConfig.findOne();
    if (!config) {
      return res.status(500).json({
        status: "error",
        message: "Presale configuration not found",
      });
    }

    const currentPhase = config.getCurrentPhase();
    const now = new Date();

    let nextPhase = null;
    let nextPhaseTime = null;
    let timeRemaining = null;

    // Calculate next phase and time remaining
    if (currentPhase === "upcoming") {
      nextPhase = "guaranteed";
      nextPhaseTime = config.phases.guaranteed.startTime;
    } else if (currentPhase === "guaranteed") {
      nextPhase = "waitlist";
      nextPhaseTime = config.phases.waitlist.startTime;
    } else if (currentPhase === "waitlist") {
      nextPhase = "public";
      nextPhaseTime = config.phases.public.startTime;
    } else if (currentPhase === "public") {
      nextPhase = "ended";
      nextPhaseTime = config.phases.public.endTime;
    }

    if (nextPhaseTime) {
      timeRemaining = Math.max(0, nextPhaseTime.getTime() - now.getTime());
    }

    res.json({
      status: "success",
      data: {
        currentPhase,
        nextPhase,
        nextPhaseTime,
        timeRemaining, // milliseconds
        phases: config.phases,
        currentTime: now,
      },
    });
  } catch (error) {
    console.error("Get phase error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get phase information",
    });
  }
});

module.exports = router;
