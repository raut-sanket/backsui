const mongoose = require("mongoose");

const presaleConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Victory Token Presale",
    },
    status: {
      type: String,
      enum: ["upcoming", "active", "paused", "ended"],
      default: "active",
    },
    currentPhase: {
      type: String,
      enum: ["guaranteed", "waitlist", "public", "ended"],
      default: "guaranteed",
    },
    presaleRate: {
      type: Number,
      default: 250, // 1 USDC = 250 VICTORY
      min: 1,
    },
    phases: {
      guaranteed: {
        startTime: {
          type: Date,
          default: () => new Date("2025-06-12T14:00:00.000Z"), // June 12 @ 2:00 PM UTC
        },
        endTime: {
          type: Date,
          default: () => new Date("2025-06-12T15:00:00.000Z"), // June 12 @ 3:00 PM UTC
        },
      },
      waitlist: {
        startTime: {
          type: Date,
          default: () => new Date("2025-06-12T15:00:00.000Z"), // June 12 @ 3:00 PM UTC
        },
        endTime: {
          type: Date,
          default: () => new Date("2025-06-13T14:00:00.000Z"), // June 13 @ 2:00 PM UTC
        },
      },
      public: {
        startTime: {
          type: Date,
          default: () => new Date("2025-06-13T14:00:00.000Z"), // June 13 @ 2:00 PM UTC
        },
        endTime: {
          type: Date,
          default: () => new Date("2025-06-20T14:00:00.000Z"), // 7 days later
        },
      },
    },
    hardCapUSDC: {
      type: Number,
      default: 100000,
      min: 1,
    },
    softCapUSDC: {
      type: Number,
      default: 15000,
      min: 1,
    },
    minInvestmentUSDC: {
      type: Number,
      default: 50,
      min: 1,
    },
    maxInvestmentUSDC: {
      type: Number,
      default: 3500,
      min: 1,
    },
    airdropPercentage: {
      type: Number,
      default: 25,
      min: 0,
      max: 100,
    },
    stakingPercentage: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  }
);

// Method to get current phase based on time
presaleConfigSchema.methods.getCurrentPhase = function () {
  const now = new Date();

  if (now < this.phases.guaranteed.startTime) {
    return "upcoming";
  } else if (
    now >= this.phases.guaranteed.startTime &&
    now < this.phases.guaranteed.endTime
  ) {
    return "guaranteed";
  } else if (
    now >= this.phases.waitlist.startTime &&
    now < this.phases.waitlist.endTime
  ) {
    return "waitlist";
  } else if (
    now >= this.phases.public.startTime &&
    now < this.phases.public.endTime
  ) {
    return "public";
  } else {
    return "ended";
  }
};

module.exports = mongoose.model("PresaleConfig", presaleConfigSchema);
