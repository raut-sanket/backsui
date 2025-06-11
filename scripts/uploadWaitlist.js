const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
require("dotenv").config();

const Whitelist = require("../models/whitelist");

async function uploadWaitlistAddresses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Update this path to your waitlist addresses CSV file
    const csvFilePath = path.join(__dirname, "../data/waitlist_addresses.csv");

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      console.log("Please create a CSV file with the following structure:");
      console.log("address");
      console.log("0x1234567890123456789012345678901234567890");
      console.log("0x2345678901234567890123456789012345678901");
      process.exit(1);
    }

    const addresses = [];
    let lineNumber = 0;

    // Read CSV file
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (row) => {
        lineNumber++;

        // Try different possible column names for wallet address
        const walletAddress =
          row.address ||
          row.wallet_address ||
          row.Address ||
          row.WALLET_ADDRESS ||
          row.walletAddress ||
          row["Wallet Address"] ||
          Object.values(row)[0]; // First column if headers don't match

        if (walletAddress && walletAddress.trim()) {
          const cleanAddress = walletAddress.toLowerCase().trim();

          // Basic Ethereum address validation
          if (cleanAddress.startsWith("0x")) {
            addresses.push({
              walletAddress: cleanAddress,
              type: "waitlist",
              isActive: true,
            });
          } else {
            console.warn(
              `Line ${lineNumber}: Invalid address format: ${walletAddress}`
            );
          }
        } else {
          console.warn(`Line ${lineNumber}: Empty or missing address`);
        }
      })
      .on("end", async () => {
        console.log(`Processing ${addresses.length} waitlist addresses...`);

        if (addresses.length === 0) {
          console.log("No valid addresses found to import");
          process.exit(0);
        }

        let imported = 0;
        let updated = 0;
        let errors = 0;

        for (const address of addresses) {
          try {
            const result = await Whitelist.findOneAndUpdate(
              { walletAddress: address.walletAddress },
              address,
              { upsert: true, new: true }
            );

            if (result.createdAt === result.updatedAt) {
              imported++;
            } else {
              updated++;
            }
          } catch (error) {
            console.error(
              `Error importing ${address.walletAddress}:`,
              error.message
            );
            errors++;
          }
        }

        console.log(`\n=== Import Summary ===`);
        console.log(`Total processed: ${addresses.length}`);
        console.log(`Successfully imported: ${imported}`);
        console.log(`Updated existing: ${updated}`);
        console.log(`Errors: ${errors}`);

        process.exit(0);
      })
      .on("error", (error) => {
        console.error("Error reading CSV file:", error);
        process.exit(1);
      });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

uploadWaitlistAddresses();
