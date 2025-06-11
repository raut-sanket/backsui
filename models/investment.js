const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    transactionHash: {
      type: String,
      required: true,
      unique: true,
    },
    usdcAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    victoryTokens: {
      allocated: {
        type: Number,
        required: true,
        min: 0,
      },
      airdrop: {
        type: Number,
        required: true,
        min: 0,
      },
      staking: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    presalePhase: {
      type: String,
      enum: ["guaranteed", "waitlist", "public"],
      required: true,
    },
    whitelistType: {
      type: String,
      enum: ["guaranteed", "waitlist", "none"],
      default: "none",
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "confirmed",
    },
    airdropStatus: {
      type: String,
      enum: ["pending", "processed"],
      default: "pending",
    },
    stakingStatus: {
      type: String,
      enum: ["pending", "staked"],
      default: "pending",
    },
    blockNumber: {
      type: Number,
    },
    blockTimestamp: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
investmentSchema.index({ walletAddress: 1 });
investmentSchema.index({ transactionHash: 1 });
investmentSchema.index({ presalePhase: 1 });
investmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Investment", investmentSchema);
