const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("connected", () => {
      logger.info("🔗 Mongoose connected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("❌ Mongoose connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️ Mongoose disconnected");
    });

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("👋 Mongoose connection closed through app termination");
      process.exit(0);
    });
  } catch (error) {
    logger.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
