import dotenv from "dotenv";
import express from "express";
import logger from "morgan";
import createError from "http-errors";
import cookieParser from "cookie-parser";
import http from "http";
import path from "path";
import passport from "passport";
import aws from "aws-sdk";

dotenv.config({ path: process.env.ENV_FILE_PATH });
aws.config.loadFromPath(process.env.AWS_CREDENTIAL_FILE_PATH || "./aws.json");

import setupAuth from "./auth/local";
import indexRouter from "./routes/index";

async function setupServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const app = express();

    app.use(logger("dev"));
    app.use(express.json());

    app.use(passport.initialize());
    app.use(passport.session());

    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    app.use(express.static(path.join(__dirname, "public")));

    app.use("/", indexRouter);

    // catch 404 and forward to error handler
    app.use((req, res, next) => {
      next(createError(404));
    });

    // error handler
    app.use((err: any, req: express.Request, res: express.Response) => {
      // set locals, only providing error in development
      res.locals.message = err.message;
      res.locals.error = req.app.get("env") === "development" ? err : {};

      // render the error page
      res.status(err.status || 500);
      res.render("error");
    });

    let server: http.Server;
    const port = process.env.PORT || "3000";
    app.set("port", port);

    console.log("Starting HTTP server...");
    server = http.createServer(app);

    server.listen(port);

    server.on("error", (error: any) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      // handle specific listen errors with friendly messages
      switch (error.code) {
      case "EADDRINUSE":
        console.error(`Port ${port} is already in use`);
        process.exit(1);
        break;
      default:
        throw error;
      }
    });

    server.on("listening", () => {
      console.log(`Server listening on port ${port}`);
      resolve(server);
    });
  });
}

async function launch() {
  console.log("Current environment:", process.env.NODE_ENV || "unknown");

  await setupServer();
  await setupAuth();
}

launch();
