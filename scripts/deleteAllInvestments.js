require("dotenv").config();
const mongoose = require("mongoose");
const Investment = require("../models/investment");

const MONGODB_URI = process.env.MONGODB_URI;

const deleteAllInvestments = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const result = await Investment.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} investment(s)`);

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error deleting investments:", error);
    process.exit(1);
  }
};

deleteAllInvestments();
