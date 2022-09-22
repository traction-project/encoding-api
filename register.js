const crypto = require("crypto");
const prompt = require("prompt");
const sqlite = require("sqlite3").verbose();
const uuid = require("uuid");

// Open connection to existing database instance
const db = new sqlite.Database("./db/database.sqlite", sqlite.OPEN_READWRITE, (err) => {
  // Exit script if connection could not be established
  if (err) {
    console.log("Database connection failed:", err);
    process.exit(1);
  }
});

// Start a user input session
prompt.start();

// Retrieve username and password via STDIN, hiding password input
prompt.get([{ name: "username" }, { name: "password", hidden: true }], (err, result) => {
  // Exit if an error occurred
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Get username and password
  const { username, password } = result;

  // Generate random salt
  const salt = crypto.randomBytes(16).toString("hex");
  // Hash password together with salt using SHA-512
  const hashedPassword = crypto.pbkdf2Sync(
    password, salt,
    10000, 512, "sha512"
  ).toString("hex");

  // Get timestamp for fields `created_at` and `updated_at`
  const now = new Date().toISOString();

  // Insert new user record into database
  db.run(
    "INSERT INTO users (id, username, password, salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [uuid.v4(), username, hashedPassword, salt, now, now],
    (err) => {
      // Exist script with error if user record could not be inserted
      if (err) {
        console.log("Could not insert user:", err);
        process.exit(1);
      }

      // Display success message
      console.log(`User '${username}' created successfully!`);
    }
  );

  // Close database connection and exit
  db.close();
});
