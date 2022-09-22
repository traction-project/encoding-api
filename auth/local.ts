import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JWTStrategy, ExtractJwt } from "passport-jwt";

import { getFromEnvironment  } from "../util";
import { User } from "../models/user";

const [ SESSION_SECRET ] = getFromEnvironment("SESSION_SECRET");

/**
 * Sets up authentication strategies for the API. The API supports basic
 * username/password authentication for obtaining a JSON Web Token. All other
 * calls require a valid token for authentication.
 */
export default async function setup() {
  // Set up local authentication strategy using username and password
  passport.use(new LocalStrategy(async (username, password, done) => {
    // Find user record using supplied username
    const user = await User.findOne({ where: { username }});

    // Validate user password against given password
    if (user && user.validatePassword(password)) {
      // Return user record if password is valid
      return done(null, user);
    }

    // Reject authentication if either no user was found or password is incorrect
    done(null, false);
  }));

  // Set up authentication strategy using JSON Web Tokens
  passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: SESSION_SECRET
  }, async (token, done) => {
    // Find user record using ID stored in token
    const user = await User.findByPk(token.id);

    // Return user record if user was found
    if (user) {
      return done(null, user);
    }

    // Reject authentication if no user was found
    done(null, false);
  }));

  // Serialize user sessions using unique user ID
  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });

  // Deserialize sessions by fetching user records from database using user ID
  passport.deserializeUser(async (id: string, done) => {
    const user = User.findByPk(id);

    // Return user record if user was found
    if (user) {
      return done(null, user);
    }

    // Return false if no user with the given ID was found
    done(null, false);
  });
}
