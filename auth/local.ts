import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";

import { getFromEnvironment  } from "../util";
import { User } from "../models/user";

const [ SESSION_SECRET ] = getFromEnvironment("SESSION_SECRET");

export default async function setup() {
  passport.use(new LocalStrategy(async (username, password, done) => {
    const user = await User.findOne({ where: { username }});

    if (user && user.validatePassword(password)) {
      return done(null, user);
    }

    done(null, false);
  }));

  passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: SESSION_SECRET
  }, async (token, done) => {
    const user = await User.findByPk(token.id);

    if (user) {
      return done(null, user);
    }

    done(null, false);
  }));

  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    const user = User.findByPk(id);

    if (user) {
      return done(null, user);
    }

    done(null, false);
  });
}
