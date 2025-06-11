const mongoose = require("mongoose");

const whitelistSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["guaranteed", "waitlist"],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Index for fast lookups
whitelistSchema.index({ walletAddress: 1 });
whitelistSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model("Whitelist", whitelistSchema);
