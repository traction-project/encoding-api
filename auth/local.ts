import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";

import { getFromEnvironment  } from "../util";

const [ SESSION_SECRET ] = getFromEnvironment("SESSION_SECRET");

export default async function setup() {
  passport.use(new LocalStrategy(async (username, password, done) => {
    done(null, false);
  }));

  passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: SESSION_SECRET
  }, (token, done) => {
    done(null, false);
  }));

  passport.serializeUser((user: any, done) => {
  });

  passport.deserializeUser((id: string, done) => {
  });
}
