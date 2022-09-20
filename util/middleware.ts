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

/**
 * Middleware functions which requires the current user to have the permissions
 * passed in as arguments. If the user object is not set, error 401 is returned
 * to the client and if the user does not have the required permissions, error
 * 403 is returned.
 * If the user is set and has the required permissions, the request is
 * forwarded to the next request handler.
 *
 * @param permissionNames Permission names required for the route
 */
export function permissionRequired(...permissionNames: Array<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.status(403);
    res.send({
      status: "ERR",
      message: "Permission failure"
    });
  };
}
