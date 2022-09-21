import { Request, Response, NextFunction, RequestHandler } from "express";
import passport from "passport";

/**
 * Middleware function which makes routes which it is applied to require a
 * means of authentication. This authentication needs to be supplied as a JSON
 * Web Token stored in the `Authorization` HTTP header.
 *
 * @returns a JWT request handler which can be used as middleware function
 */
export function tokenRequired(req: Request, res: Response, next: NextFunction): RequestHandler {
  return passport.authenticate("jwt", { session: false })(req, res, next);
}

/**
 * Middleware function which makes routes which it is applied to require a
 * an active session, achieved through a session cookie.
 *
 * @returns a JWT request handler which can be used as middleware function
 */
export function authRequired(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    next();
  } else {
    res.status(401);
    res.send({
      status: "ERR",
      message: "Authorisation required"
    });
  }
}
