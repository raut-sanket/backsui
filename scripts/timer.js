const mongoose = require("mongoose");

// Import your PresaleConfig model (adjust path as needed)
const PresaleConfig = require("../models/presaleConfig"); // Update this path

async function updatePresaleTimes() {
  try {
    // Connect to MongoDB (adjust connection string as needed)
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb+srv://suidev:shah%21%40%23%2498@cluster0.pi07vqg.mongodb.net/presaleDatatest"
    );

    console.log("Connected to MongoDB");

    // Define the correct times according to your requirements
    const updateData = {
      // Update the phases with exact times
      "phases.guaranteed.startTime": new Date("2025-06-12T14:00:00.000Z"), // June 12 @ 2:00 PM UTC
      "phases.guaranteed.endTime": new Date("2025-06-12T15:00:00.000Z"), // June 12 @ 3:00 PM UTC

      "phases.waitlist.startTime": new Date("2025-06-12T15:00:00.000Z"), // June 12 @ 3:00 PM UTC (Whitelisted)
      "phases.waitlist.endTime": new Date("2025-06-13T14:00:00.000Z"), // June 13 @ 2:00 PM UTC

      "phases.public.startTime": new Date("2025-06-13T14:00:00.000Z"), // June 13 @ 2:00 PM UTC (Public raise)
      "phases.public.endTime": new Date("2025-06-20T14:00:00.000Z"), // 7 days later (adjust if needed)

      // Update the current phase and status based on current time
      currentPhase: getCurrentPhaseFromTime(),
      status: "active",

      // Update timestamp
      updatedAt: new Date(),
    };

    // Update all PresaleConfig documents (or specify conditions if you have multiple)
    const result = await PresaleConfig.updateMany(
      {}, // Empty filter updates all documents. Add conditions here if needed: { name: "Victory Token Presale" }
      { $set: updateData }
    );

    console.log(`✅ Updated ${result.modifiedCount} presale configuration(s)`);

    // Verify the update by fetching the updated document
    const updatedConfig = await PresaleConfig.findOne();
    if (updatedConfig) {
      console.log("\n📅 Updated Presale Schedule:");
      console.log(
        `Guaranteed Phase: ${updatedConfig.phases.guaranteed.startTime.toISOString()} - ${updatedConfig.phases.guaranteed.endTime.toISOString()}`
      );
      console.log(
        `Waitlist Phase:   ${updatedConfig.phases.waitlist.startTime.toISOString()} - ${updatedConfig.phases.waitlist.endTime.toISOString()}`
      );
      console.log(
        `Public Phase:     ${updatedConfig.phases.public.startTime.toISOString()} - ${updatedConfig.phases.public.endTime.toISOString()}`
      );
      console.log(`Current Phase:    ${updatedConfig.getCurrentPhase()}`);
      console.log(`Status:           ${updatedConfig.status}`);
    }
  } catch (error) {
    console.error("❌ Error updating presale times:", error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
}

// Helper function to determine current phase based on the new times
function getCurrentPhaseFromTime() {
  const now = new Date();
  const guaranteedStart = new Date("2025-06-12T14:00:00.000Z");
  const guaranteedEnd = new Date("2025-06-12T15:00:00.000Z");
  const waitlistStart = new Date("2025-06-12T15:00:00.000Z");
  const waitlistEnd = new Date("2025-06-13T14:00:00.000Z");
  const publicStart = new Date("2025-06-13T14:00:00.000Z");
  const publicEnd = new Date("2025-06-20T14:00:00.000Z");

  if (now < guaranteedStart) {
    return "upcoming";
  } else if (now >= guaranteedStart && now < guaranteedEnd) {
    return "guaranteed";
  } else if (now >= waitlistStart && now < waitlistEnd) {
    return "waitlist";
  } else if (now >= publicStart && now < publicEnd) {
    return "public";
  } else {
    return "ended";
  }
}

// Alternative function for specific document update
async function updateSpecificPresale(presaleId) {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/your-database"
    );

    const updateData = {
      "phases.guaranteed.startTime": new Date("2025-06-12T14:00:00.000Z"),
      "phases.guaranteed.endTime": new Date("2025-06-12T15:00:00.000Z"),
      "phases.waitlist.startTime": new Date("2025-06-12T15:00:00.000Z"),
      "phases.waitlist.endTime": new Date("2025-06-13T14:00:00.000Z"),
      "phases.public.startTime": new Date("2025-06-13T14:00:00.000Z"),
      "phases.public.endTime": new Date("2025-06-20T14:00:00.000Z"),
      currentPhase: getCurrentPhaseFromTime(),
      status: "active",
      updatedAt: new Date(),
    };

    const result = await PresaleConfig.findByIdAndUpdate(
      presaleId,
      { $set: updateData },
      { new: true }
    );

    console.log("✅ Updated specific presale:", result);
  } catch (error) {
    console.error("❌ Error updating specific presale:", error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the update
if (require.main === module) {
  updatePresaleTimes();
}

module.exports = { updatePresaleTimes, updateSpecificPresale };



