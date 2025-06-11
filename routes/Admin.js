const express = require("express");
const Investment = require("../models/investment");
const Whitelist = require("../models/whitelist");
const PresaleConfig = require("../models/presaleConfig");
const auth = require("../middleware/auth");

const router = express.Router();

// @route   GET /api/v1/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private (Admin)
router.get("/dashboard", auth, async (req, res) => {
  try {
    // Get overall stats
    const overviewStats = await Investment.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: null,
          totalRaised: { $sum: "$usdcAmount" },
          totalInvestments: { $sum: 1 },
          uniqueInvestors: { $addToSet: "$walletAddress" },
          averageInvestment: { $avg: "$usdcAmount" },
          pendingAirdrops: {
            $sum: { $cond: [{ $eq: ["$airdropStatus", "pending"] }, 1, 0] },
          },
          pendingStaking: {
            $sum: { $cond: [{ $eq: ["$stakingStatus", "pending"] }, 1, 0] },
          },
          totalVictoryTokens: { $sum: "$victoryTokens.allocated" },
        },
      },
    ]);

    const overview = overviewStats[0] || {
      totalRaised: 0,
      totalInvestments: 0,
      uniqueInvestors: [],
      averageInvestment: 0,
      pendingAirdrops: 0,
      pendingStaking: 0,
      totalVictoryTokens: 0,
    };

    // Get presale config
    const config = await PresaleConfig.findOne();
    const progressPercentage = config
      ? (overview.totalRaised / config.hardCapUSDC) * 100
      : 0;

    const currentPhase = config ? config.getCurrentPhase() : "unknown";

    // Get phase stats
    const phaseStats = await Investment.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: "$presalePhase",
          totalUSDC: { $sum: "$usdcAmount" },
          totalInvestments: { $sum: 1 },
          uniqueInvestors: { $addToSet: "$walletAddress" },
          totalVictoryTokens: { $sum: "$victoryTokens.allocated" },
        },
      },
    ]);

    // Get whitelist stats
    const whitelistStats = await Whitelist.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          active: { $sum: { $cond: ["$isActive", 1, 0] } },
        },
      },
    ]);

    // Get recent investments
    const recentInvestments = await Investment.find({ status: "confirmed" })
      .select(
        "walletAddress usdcAmount victoryTokens presalePhase whitelistType status createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(10);

    // Format stats
    const formattedPhaseStats = phaseStats.map((stat) => ({
      phase: stat._id,
      totalUSDC: stat.totalUSDC,
      totalInvestments: stat.totalInvestments,
      uniqueInvestors: stat.uniqueInvestors.length,
      totalVictoryTokens: stat.totalVictoryTokens,
    }));

    const formattedWhitelistStats = {
      guaranteed: { count: 0, active: 0 },
      waitlist: { count: 0, active: 0 },
      total: { count: 0, active: 0 },
    };

    whitelistStats.forEach((stat) => {
      formattedWhitelistStats[stat._id] = stat;
      formattedWhitelistStats.total.count += stat.count;
      formattedWhitelistStats.total.active += stat.active;
    });

    // Get daily investment stats for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await Investment.aggregate([
      {
        $match: {
          status: "confirmed",
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalUSDC: { $sum: "$usdcAmount" },
          totalInvestments: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      status: "success",
      data: {
        overview: {
          totalRaised: overview.totalRaised,
          totalInvestments: overview.totalInvestments,
          uniqueInvestors: overview.uniqueInvestors.length,
          averageInvestment: overview.averageInvestment,
          progressPercentage: Math.min(progressPercentage, 100),
          pendingAirdrops: overview.pendingAirdrops,
          pendingStaking: overview.pendingStaking,
          totalVictoryTokens: overview.totalVictoryTokens,
        },
        presaleConfig: {
          ...config.toObject(),
          currentPhase,
        },
        phaseStats: formattedPhaseStats,
        whitelistStats: formattedWhitelistStats,
        recentInvestments,
        dailyStats,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get dashboard data",
    });
  }
});

// @route   GET /api/v1/admin/investments
// @desc    Get all investments with pagination and filters
// @access  Private (Admin)
router.get("/investments", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.walletAddress) {
      filter.walletAddress = { $regex: req.query.walletAddress, $options: "i" };
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.phase) filter.presalePhase = req.query.phase;
    if (req.query.whitelistType) filter.whitelistType = req.query.whitelistType;

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const investments = await Investment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Investment.countDocuments(filter);

    // Get stats for filtered results
    const stats = await Investment.aggregate([
      { $match: filter },
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

    res.json({
      status: "success",
      data: {
        investments,
        stats: stats[0] || {
          totalUSDC: 0,
          totalVictoryTokens: 0,
          totalInvestments: 0,
          uniqueInvestors: [],
        },
      },
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get investments error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get investments",
    });
  }
});

// @route   GET /api/v1/admin/investors
// @desc    Get investor summary
// @access  Private (Admin)
router.get("/investors", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get investor summaries
    const investors = await Investment.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: "$walletAddress",
          totalUSDC: { $sum: "$usdcAmount" },
          totalVictoryTokens: { $sum: "$victoryTokens.allocated" },
          totalInvestments: { $sum: 1 },
          whitelistType: { $first: "$whitelistType" },
          firstInvestment: { $min: "$createdAt" },
          lastInvestment: { $max: "$createdAt" },
          phases: { $addToSet: "$presalePhase" },
        },
      },
      { $sort: { totalUSDC: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalInvestors = await Investment.aggregate([
      { $match: { status: "confirmed" } },
      { $group: { _id: "$walletAddress" } },
      { $count: "total" },
    ]);

    const total = totalInvestors[0]?.total || 0;

    res.json({
      status: "success",
      data: {
        investors: investors.map((investor) => ({
          walletAddress: investor._id,
          totalUSDC: investor.totalUSDC,
          totalVictoryTokens: investor.totalVictoryTokens,
          totalInvestments: investor.totalInvestments,
          whitelistType: investor.whitelistType,
          firstInvestment: investor.firstInvestment,
          lastInvestment: investor.lastInvestment,
          phases: investor.phases,
        })),
      },
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get investors error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get investors",
    });
  }
});

// @route   PUT /api/v1/admin/config
// @desc    Update presale configuration
// @access  Private (Admin)
router.put("/config", auth, async (req, res) => {
  try {
    const config = await PresaleConfig.findOne();
    if (!config) {
      return res.status(404).json({
        status: "error",
        message: "Presale configuration not found",
      });
    }

    // Update allowed fields
    const allowedFields = [
      "status",
      "presaleRate",
      "hardCapUSDC",
      "softCapUSDC",
      "minInvestmentUSDC",
      "maxInvestmentUSDC",
      "airdropPercentage",
      "stakingPercentage",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });

    // Update phase times if provided
    if (req.body.phases) {
      Object.keys(req.body.phases).forEach((phase) => {
        if (config.phases[phase] && req.body.phases[phase]) {
          Object.assign(config.phases[phase], req.body.phases[phase]);
        }
      });
    }

    await config.save();

    res.json({
      status: "success",
      data: config,
    });
  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update configuration",
    });
  }
});

module.exports = router;
