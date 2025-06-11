const mongoose = require("mongoose");
const PresaleConfig = require("../models/presaleConfig"); // Update path if needed

async function setTestPresaleSchedule() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb+srv://suidev:shah%21%40%23%2498@cluster0.pi07vqg.mongodb.net/presaleDatatest";
    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB");
    console.log("🚀 Setting up TEST PRESALE SCHEDULE...\n");

    // Get current time
    const now = new Date();
    console.log(`Current Time: ${now.toISOString()}`);

    // Calculate phase times
    const guaranteedStart = new Date(now.getTime() + 0 * 60 * 1000); // 5 minutes from now
    const guaranteedEnd = new Date(guaranteedStart.getTime() + 1 * 60 * 1000); // 10 min duration

    const waitlistStart = new Date(guaranteedEnd.getTime()); // 2 min gap
    // const waitlistStart = new Date(now.getTime()); // 2 min gap
    const waitlistEnd = new Date(waitlistStart.getTime() + 2 * 60 * 1000); // 10 min duration

    const publicStart = new Date(waitlistEnd.getTime()); // 2 min gap
    const publicEnd = new Date(publicStart.getTime() + 2 * 60 * 1000); // 15 min duration

    console.log("📅 PROPOSED SCHEDULE:");
    console.log(
      `Guaranteed Phase: ${guaranteedStart.toISOString()} - ${guaranteedEnd.toISOString()}`
    );
    console.log(
      `  ⏰ Starts in: ${Math.round(
        (guaranteedStart.getTime() - now.getTime()) / 1000 / 60
      )} minutes`
    );
    console.log(
      `Waitlist Phase:   ${waitlistStart.toISOString()} - ${waitlistEnd.toISOString()}`
    );
    console.log(
      `  ⏰ Starts in: ${Math.round(
        (waitlistStart.getTime() - now.getTime()) / 1000 / 60
      )} minutes`
    );
    console.log(
      `Public Phase:     ${publicStart.toISOString()} - ${publicEnd.toISOString()}`
    );
    console.log(
      `  ⏰ Starts in: ${Math.round(
        (publicStart.getTime() - now.getTime()) / 1000 / 60
      )} minutes`
    );

    // Confirm before proceeding
    console.log("\n⚠️  WARNING: This will update your live presale schedule!");
    console.log("⚠️  Make sure this is what you want for testing.");

    // Update the database
    const updateData = {
      "phases.guaranteed.startTime": guaranteedStart,
      "phases.guaranteed.endTime": guaranteedEnd,
      "phases.waitlist.startTime": waitlistStart,
      "phases.waitlist.endTime": waitlistEnd,
      "phases.public.startTime": publicStart,
      "phases.public.endTime": publicEnd,

      // The currentPhase will be automatically determined by getCurrentPhase() method
      // But we can set initial status
      status: "active",
      updatedAt: new Date(),
    };

    const result = await PresaleConfig.updateMany({}, { $set: updateData });

    console.log(
      `\n✅ Updated ${result.modifiedCount} presale configuration(s)`
    );

    // Verify the update and show current phase
    const updatedConfig = await PresaleConfig.findOne();
    if (updatedConfig) {
      const currentPhase = updatedConfig.getCurrentPhase();

      console.log("\n🎯 UPDATED CONFIGURATION:");
      console.log(`Current Phase: ${currentPhase}`);
      console.log(`Status: ${updatedConfig.status}`);

      // Show countdown to first phase
      const timeToGuaranteed = guaranteedStart.getTime() - new Date().getTime();
      const minutesToGuaranteed = Math.floor(timeToGuaranteed / 1000 / 60);
      const secondsToGuaranteed = Math.floor(
        (timeToGuaranteed % (1000 * 60)) / 1000
      );

      console.log(`\n⏱️  COUNTDOWN TO GUARANTEED PHASE:`);
      console.log(`${minutesToGuaranteed}m ${secondsToGuaranteed}s remaining`);

      console.log("\n📊 PHASE STATUS:");
      console.log(
        `Guaranteed: ${
          currentPhase === "guaranteed" ? "🟢 ACTIVE" : "⏳ Waiting"
        }`
      );
      console.log(
        `Waitlist:   ${
          currentPhase === "waitlist" ? "🟢 ACTIVE" : "⏳ Waiting"
        }`
      );
      console.log(
        `Public:     ${currentPhase === "public" ? "🟢 ACTIVE" : "⏳ Waiting"}`
      );
    }
  } catch (error) {
    console.error("❌ Error setting up test schedule:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Alternative function for custom timing
async function setCustomTestSchedule(startInMinutes = 18) {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL ||
      "mongodb://localhost:27017/victory-presale";
    await mongoose.connect(mongoUri);

    const now = new Date();

    // Custom timing
    const guaranteedStart = new Date(
      now.getTime() + startInMinutes * 60 * 1000
    );
    const guaranteedEnd = new Date(guaranteedStart.getTime() + 10 * 60 * 1000);
    const waitlistStart = new Date(guaranteedEnd.getTime() + 2 * 60 * 1000);
    const waitlistEnd = new Date(waitlistStart.getTime() + 10 * 60 * 1000);
    const publicStart = new Date(waitlistEnd.getTime() + 2 * 60 * 1000);
    const publicEnd = new Date(publicStart.getTime() + 15 * 60 * 1000);

    const updateData = {
      "phases.guaranteed.startTime": guaranteedStart,
      "phases.guaranteed.endTime": guaranteedEnd,
      "phases.waitlist.startTime": waitlistStart,
      "phases.waitlist.endTime": waitlistEnd,
      "phases.public.startTime": publicStart,
      "phases.public.endTime": publicEnd,
      status: "active",
      updatedAt: new Date(),
    };

    await PresaleConfig.updateMany({}, { $set: updateData });

    console.log(
      `✅ Custom schedule set! First phase starts in ${startInMinutes} minutes.`
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

// Quick start function (starts in 2 minutes for immediate testing)
async function setQuickTestSchedule() {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.DATABASE_URL ||
      "mongodb://localhost:27017/victory-presale";
    await mongoose.connect(mongoUri);

    const now = new Date();

    // Very quick testing schedule
    const guaranteedStart = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes
    const guaranteedEnd = new Date(guaranteedStart.getTime() + 3 * 60 * 1000); // 3 min duration
    const waitlistStart = new Date(guaranteedEnd.getTime() + 1 * 60 * 1000); // 1 min gap
    const waitlistEnd = new Date(waitlistStart.getTime() + 3 * 60 * 1000); // 3 min duration
    const publicStart = new Date(waitlistEnd.getTime() + 1 * 60 * 1000); // 1 min gap
    const publicEnd = new Date(publicStart.getTime() + 5 * 60 * 1000); // 5 min duration

    const updateData = {
      "phases.guaranteed.startTime": guaranteedStart,
      "phases.guaranteed.endTime": guaranteedEnd,
      "phases.waitlist.startTime": waitlistStart,
      "phases.waitlist.endTime": waitlistEnd,
      "phases.public.startTime": publicStart,
      "phases.public.endTime": publicEnd,
      status: "active",
      updatedAt: new Date(),
    };

    await PresaleConfig.updateMany({}, { $set: updateData });

    console.log("🚀 QUICK TEST SCHEDULE SET!");
    console.log(`Guaranteed starts in 2 minutes!`);
    console.log("Perfect for immediate testing");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

// Export functions
if (require.main === module) {
  // Get command line argument
  const mode = process.argv[2];

  if (mode === "quick") {
    setQuickTestSchedule();
  } else if (mode === "custom") {
    const minutes = parseInt(process.argv[3]) || 18;
    setCustomTestSchedule(minutes);
  } else {
    setTestPresaleSchedule();
  }
}

module.exports = {
  setTestPresaleSchedule,
  setCustomTestSchedule,
  setQuickTestSchedule,
};
