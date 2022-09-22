import dotenv from "dotenv";
import express from "express";
import logger from "morgan";
import createError from "http-errors";
import http from "http";
import passport from "passport";
import aws from "aws-sdk";

// Load contents of .env file
dotenv.config({ path: process.env.ENV_FILE_PATH });
// Load AWS credentials
aws.config.loadFromPath(process.env.AWS_CREDENTIAL_FILE_PATH || "./aws.json");

import { Sequelize } from "sequelize";

import setupDatabase from "./models";
import setupAuth from "./auth/local";
import indexRouter from "./routes/index";

// Open database connection to SQLite database
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "db/database.sqlite"
});

/**
 * Sets up the HTTP server with the running Express app. The function resolves
 * a promise with the running HTTP server once the server is listening for
 * incoming requests.
 *
 * @returns An promise which resolves to an instance of a HTTP server
 */
async function setupServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const app = express();

    // Set up logging and JSON functionality
    app.use(logger("dev"));
    app.use(express.json());

    // Initialise authentication layer
    app.use(passport.initialize());

    app.use(express.urlencoded({ extended: false }));

    // Mount API routes
    app.use("/", indexRouter);

    // Catch 404 and forward to error handler
    app.use((req, res, next) => {
      next(createError(404));
    });

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response) => {
      // Set locals, only providing error in development
      res.locals.message = err.message;
      res.locals.error = req.app.get("env") === "development" ? err : {};

      // Render the error page
      res.status(err.status || 500);
      res.render("error");
    });

    // Set port to listen on
    const port = process.env.PORT || "3000";
    app.set("port", port);

    // Create server and start listening
    console.log("Starting HTTP server...");
    const server = http.createServer(app);

    server.listen(port);

    // Error handler
    server.on("error", (error: any) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      // Handle specific listen errors with friendly messages
      switch (error.code) {
      case "EADDRINUSE":
        console.error(`Port ${port} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
      }
    });

    // Resolve promise with server instance once server is ready to accept requests
    server.on("listening", () => {
      console.log(`Server listening on port ${port}`);
      resolve(server);
    });
  });
}

/**
 * Launches the application by setting up the server, the SQLite database and
 * the authentication layer
 */
async function launch() {
  console.log("Current environment:", process.env.NODE_ENV || "unknown");

  await setupServer();
  await setupDatabase(sequelize);
  await setupAuth();
}

// Launch the application
launch();
