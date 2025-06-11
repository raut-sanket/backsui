const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/user");
const PresaleConfig = require("../models/presaleconfig");

async function setupAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: process.env.ADMIN_EMAIL,
    });
    if (existingAdmin) {
      console.log("Admin user already exists");
    } else {
      // Create admin user
      const admin = new User({
        name: "Admin",
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: "super_admin",
      });

      await admin.save();
      console.log("Admin user created successfully");
    }

    // Check if presale config exists
    const existingConfig = await PresaleConfig.findOne();
    if (existingConfig) {
      console.log("Presale config already exists");
    } else {
      // Create default presale config
      const config = new PresaleConfig();
      await config.save();
      console.log("Default presale config created");
    }

    console.log("Setup completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Setup error:", error);
    process.exit(1);
  }
}

setupAdmin();
