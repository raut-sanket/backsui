const mongoose = require("mongoose");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
require("dotenv").config();

const Whitelist = require("../models/whitelist");

async function uploadGuaranteedAddresses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Update this path to your guaranteed addresses CSV file
    const csvFilePath = path.join(
      __dirname,
      "../data/guaranteed_addresses.csv"
    );

    console.log(`Looking for CSV file at: ${csvFilePath}`);

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      console.log(
        "Please create a CSV file with wallet addresses, one per line"
      );
      process.exit(1);
    }

    // Check file stats
    const stats = fs.statSync(csvFilePath);
    console.log(`File size: ${stats.size} bytes`);

    const addresses = [];
    let lineNumber = 0;

    // Read CSV file without expecting headers
    fs.createReadStream(csvFilePath)
      .pipe(csv({ headers: false })) // Don't treat first row as headers
      .on("data", (row) => {
        lineNumber++;

        // Get the first column value (since headers: false, columns are numbered)
        const walletAddress = row[0] || row["0"];

        console.log(`Line ${lineNumber}: Processing "${walletAddress}"`);

        if (walletAddress && walletAddress.trim()) {
          const cleanAddress = walletAddress.toLowerCase().trim();

          // Basic Ethereum address validation
          if (cleanAddress.startsWith("0x")) {
            addresses.push({
              walletAddress: cleanAddress,
              type: "guaranteed",
              isActive: true,
            });
            console.log(
              `Line ${lineNumber}: Valid address added: ${cleanAddress}`
            );
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
        console.log(`Processing ${addresses.length} guaranteed addresses...`);

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

            // Check if this is a new document (createdAt equals updatedAt)
            const isNew =
              result.createdAt.getTime() === result.updatedAt.getTime();

            if (isNew) {
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

uploadGuaranteedAddresses();
