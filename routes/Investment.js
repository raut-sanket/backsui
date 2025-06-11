const express = require("express");
const { body, validationResult } = require("express-validator");
const Investment = require("../models/investment");
const Whitelist = require("../models/whitelist");
const PresaleConfig = require("../models/presaleConfig");

const router = express.Router();

// ADDED: Helper function to check phase eligibility (matches frontend logic)
const checkPhaseEligibility = (userWhitelistType, currentPhase) => {
  console.log(
    `Backend phase eligibility check: User=${userWhitelistType}, Phase=${currentPhase}`
  );

  // Guaranteed users can invest in ALL phases
  if (userWhitelistType === "guaranteed") {
    console.log("Guaranteed user - eligible for all phases");
    return true;
  }

  // Waitlist users can invest in waitlist and public phases
  if (userWhitelistType === "waitlist") {
    const eligible = currentPhase === "waitlist" || currentPhase === "public";
    console.log(`Waitlist user - eligible for waitlist/public: ${eligible}`);
    return eligible;
  }

  // Public users (none) can only invest in public phase
  if (userWhitelistType === "none" || !userWhitelistType) {
    const eligible = currentPhase === "public";
    console.log(`Public user - eligible for public only: ${eligible}`);
    return eligible;
  }

  console.log("Unknown whitelist type - not eligible");
  return false;
};

// @route   POST /api/v1/investment/create
// @desc    Create new investment
// @access  Public
router.post(
  "/create",
  [
    body("walletAddress").isString().notEmpty(),
    body("transactionHash").isString().notEmpty(),
    body("usdcAmount").isNumeric().isFloat({ min: 0 }),
    body("calculatedTokens").isNumeric().isFloat({ min: 0 }),
    body("estimatedAirdrop").isNumeric().isFloat({ min: 0 }),
    body("estimatedStaking").isNumeric().isFloat({ min: 0 }),
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

      const {
        walletAddress,
        transactionHash,
        usdcAmount,
        calculatedTokens,
        estimatedAirdrop,
        estimatedStaking,
      } = req.body;

      // Check if transaction hash already exists
      const existingInvestment = await Investment.findOne({ transactionHash });
      if (existingInvestment) {
        return res.status(400).json({
          status: "error",
          message: "Transaction already recorded",
        });
      }

      // Get presale config
      const config = await PresaleConfig.findOne();
      if (!config) {
        return res.status(500).json({
          status: "error",
          message: "Presale configuration not found",
        });
      }

      // Get current phase based on time
      const currentPhase = config.getCurrentPhase();

      if (currentPhase === "upcoming") {
        return res.status(400).json({
          status: "error",
          message: "Presale has not started yet",
        });
      }

      if (currentPhase === "ended") {
        return res.status(400).json({
          status: "error",
          message: "Presale has ended",
        });
      }

      // Validate investment amount
      if (
        usdcAmount < config.minInvestmentUSDC ||
        usdcAmount > config.maxInvestmentUSDC
      ) {
        return res.status(400).json({
          status: "error",
          message: `Investment amount must be between $${config.minInvestmentUSDC} and $${config.maxInvestmentUSDC}`,
        });
      }

      // UPDATED: Check eligibility using hierarchical phase access logic
      let whitelistType = "none";
      const cleanWalletAddress = walletAddress.toLowerCase();

      if (currentPhase !== "public") {
        // For guaranteed and waitlist phases, check whitelist eligibility
        const whitelistEntry = await Whitelist.findOne({
          walletAddress: cleanWalletAddress,
          isActive: true,
        });

        if (!whitelistEntry) {
          return res.status(400).json({
            status: "error",
            message: `Wallet not whitelisted for ${currentPhase} phase`,
          });
        }

        whitelistType = whitelistEntry.type;

        // UPDATED: Use hierarchical eligibility check instead of strict matching
        const isEligible = checkPhaseEligibility(whitelistType, currentPhase);

        if (!isEligible) {
          let errorMessage = "";
          if (whitelistType === "waitlist" && currentPhase === "guaranteed") {
            errorMessage = "Waitlist users must wait for waitlist phase";
          } else if (whitelistType === "none" && currentPhase !== "public") {
            errorMessage = "Public users must wait for public phase";
          } else {
            errorMessage = `Wallet not eligible for ${currentPhase} phase`;
          }

          return res.status(400).json({
            status: "error",
            message: errorMessage,
          });
        }

        console.log(
          `✅ Backend eligibility check passed: ${whitelistType} user in ${currentPhase} phase`
        );
      }

      // Check hard cap
      const totalRaised = await Investment.aggregate([
        { $match: { status: "confirmed" } },
        { $group: { _id: null, total: { $sum: "$usdcAmount" } } },
      ]);

      const currentRaised = totalRaised[0]?.total || 0;
      if (currentRaised + usdcAmount > config.hardCapUSDC) {
        return res.status(400).json({
          status: "error",
          message: "Investment would exceed hard cap",
        });
      }

      // Create investment
      const investment = new Investment({
        walletAddress: cleanWalletAddress,
        transactionHash,
        usdcAmount,
        victoryTokens: {
          allocated: calculatedTokens,
          airdrop: estimatedAirdrop,
          staking: estimatedStaking,
        },
        presalePhase: currentPhase,
        whitelistType,
        status: "confirmed", // In production, verify on blockchain first
      });

      await investment.save();

      console.log(
        `✅ Investment recorded successfully: ${cleanWalletAddress} - $${usdcAmount} USDC in ${currentPhase} phase`
      );

      res.status(201).json({
        status: "success",
        data: {
          investment,
        },
      });
    } catch (error) {
      console.error("Create investment error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to create investment",
      });
    }
  }
);

// @route   GET /api/v1/investment/recent
// @desc    Get recent investments
// @access  Public
router.get("/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const investments = await Investment.find({ status: "confirmed" })
      .select(
        "walletAddress usdcAmount victoryTokens.allocated transactionHash status createdAt presalePhase"
      )
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      status: "success",
      data: investments,
    });
  } catch (error) {
    console.error("Get recent investments error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get recent investments",
    });
  }
});

// @route   GET /api/v1/investment/user/:address
// @desc    Get user investments
// @access  Public
router.get("/user/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const walletAddress = address.toLowerCase();

    const investments = await Investment.find({
      walletAddress,
      status: "confirmed",
    }).sort({ createdAt: -1 });

    // Calculate summary
    const summary = investments.reduce(
      (acc, inv) => {
        acc.totalUSDC += inv.usdcAmount;
        acc.totalVictoryTokens += inv.victoryTokens.allocated;
        acc.totalAirdropTokens += inv.victoryTokens.airdrop;
        acc.totalStakingTokens += inv.victoryTokens.staking;
        return acc;
      },
      {
        walletAddress,
        totalInvestments: investments.length,
        totalUSDC: 0,
        totalVictoryTokens: 0,
        totalAirdropTokens: 0,
        totalStakingTokens: 0,
        investments,
      }
    );

    res.json({
      status: "success",
      data: summary,
    });
  } catch (error) {
    console.error("Get user investments error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to get user investments",
    });
  }
});

// @route   GET /api/v1/investment/validate/:address
// @desc    Validate if user can invest in current phase
// @access  Public
router.get("/validate/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const walletAddress = address.toLowerCase();

    // Get presale config
    const config = await PresaleConfig.findOne();
    if (!config) {
      return res.status(500).json({
        status: "error",
        message: "Presale configuration not found",
      });
    }

    // Get current phase
    const currentPhase = config.getCurrentPhase();

    let canInvest = false;
    let reason = "";
    let whitelistType = "none";
    let eligible = false;
    let isWhitelisted = false;

    if (currentPhase === "upcoming") {
      reason = "Presale has not started yet";
    } else if (currentPhase === "ended") {
      reason = "Presale has ended";
    } else if (currentPhase === "public") {
      canInvest = true;
      eligible = true;
      reason = "Public phase - anyone can invest";
    } else {
      // Check whitelist for guaranteed/waitlist phases
      const whitelistEntry = await Whitelist.findOne({
        walletAddress,
        isActive: true,
      });

      if (!whitelistEntry) {
        reason = `Wallet not whitelisted for ${currentPhase} phase`;
        eligible = false;
        isWhitelisted = false;
      } else {
        whitelistType = whitelistEntry.type;
        isWhitelisted = true;

        // UPDATED: Use hierarchical eligibility check
        const isEligibleForPhase = checkPhaseEligibility(
          whitelistType,
          currentPhase
        );

        if (isEligibleForPhase) {
          canInvest = true;
          eligible = true;
          reason = `Eligible for ${currentPhase} phase as ${whitelistType} user`;
        } else {
          eligible = false;
          if (whitelistType === "waitlist" && currentPhase === "guaranteed") {
            reason = "Waitlist users must wait for waitlist phase";
          } else if (whitelistType === "none" && currentPhase !== "public") {
            reason = "Public users must wait for public phase";
          } else {
            reason = `Not eligible for ${currentPhase} phase`;
          }
        }
      }
    }

    // Get current investment total
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
        },
      },
    ]);

    const currentInvestment = investmentStats[0]?.totalInvested || 0;

    console.log(`Backend validation result for ${walletAddress}:`, {
      canInvest,
      eligible,
      currentPhase,
      whitelistType,
      isWhitelisted,
      reason,
    });

    res.json({
      status: "success",
      data: {
        canInvest,
        reason,
        currentPhase,
        whitelistType,
        currentInvestment,
        minInvestment: config.minInvestmentUSDC,
        maxInvestment: config.maxInvestmentUSDC,
        presaleRate: config.presaleRate,
        eligible,
        isWhitelisted,
      },
    });
  } catch (error) {
    console.error("Validate investment error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to validate investment",
    });
  }
});

module.exports = router;
