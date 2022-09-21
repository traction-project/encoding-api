const crypto = require("crypto");
const prompt = require("prompt");
const sqlite = require("sqlite3").verbose();
const uuid = require("uuid");

const db = new sqlite.Database("./db/database.sqlite", sqlite.OPEN_READWRITE, (err) => {
  if (err) {
    console.log("Database connection failed:", err);
    process.exit(1);
  }
});

prompt.start();

prompt.get([{ name: "username" }, { name: "password", hidden: true }], (err, result) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  const { username, password } = result;

  const salt = crypto.randomBytes(16).toString("hex");
  const hashedPassword = crypto.pbkdf2Sync(
    password, salt,
    10000, 512, "sha512"
  ).toString("hex");

  const now = new Date().toISOString();

  db.run(
    "INSERT INTO users (id, username, password, salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [uuid.v4(), username, hashedPassword, salt, now, now],
    (err) => {
      if (err) {
        console.log("Could not insert user:", err);
        process.exit(1);
      }

      console.log(`User '${username}' created successfully!`);
    }
  );

  db.close();
});
