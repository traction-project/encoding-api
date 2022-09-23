import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Sequelize, Model, InferAttributes, InferCreationAttributes, CreationOptional, DataTypes } from "sequelize";

import { getFromEnvironment } from "../util";

const [ SESSION_SECRET ] = getFromEnvironment("SESSION_SECRET");
const KEY_PASSWORD_LEN = 512;

/**
 * Data type definition for user tokens which are returned by login requests.
 */
interface UserToken {
  _id: string;
  username: string;
  token: string;
}

/**
 * Model definition for storing user records
 */
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare username: string;
  declare password: string;
  declare salt: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  /**
   * Validates a supplied password against the hash associated with the current
   * instance.
   *
   * @param password Password to validate
   * @returns True if the password matches the current user, false otherwise
   */
  public validatePassword(password: string): boolean {
    // Hash given password together with salt
    const hashedPassword = crypto.pbkdf2Sync(
      password, this.salt,
      10000, KEY_PASSWORD_LEN,
      "sha512"
    ).toString("hex");

    // Compare generated hash with value stored in record
    return this.password == hashedPassword;
  }

  /**
   * Generates a JSON Web Token, signs it using the value of `SESSION_SECRET`
   * and returns the signed token as a string.
   *
   * @param validityInDays Validity of the token in days, defaults to 60
   * @returns The signed JSON Web Token
   */
  public generateToken(validityInDays = 60) {
    // Generate timestamp n days from now
    const now = new Date();
    const expirationDate = new Date().setDate(now.getDate() + validityInDays);

    // Generate and sign token using SESSION_SECRET
    return jwt.sign({
      id: this.id,
      username: this.username,
      exp: Math.floor(expirationDate / 1000)
    }, SESSION_SECRET);
  }

  /**
   * Returns a data structure containing the current user's ID, username and
   * a signed JSON Web Token which is valid for 60 days.
   *
   * @returns A data structure containing the user's ID, username and a signed token
   */
  public getAuth(): UserToken {
    return {
      _id: `${this.id}`,
      username: this.username,
      token: this.generateToken()
    };
  }
}

/**
 * Initialises the User model and associates it to an active Sequelize session.
 *
 * @param sequelize A Sequelize instance with an open database connection
 */
export default function (sequelize: Sequelize) {
  // Schema definition for records of the User model
  User.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    password: {
      type: DataTypes.STRING(KEY_PASSWORD_LEN * 2),
      allowNull: false,
      set(this: User, value: string) {
        // Generate random salt
        this.salt = crypto.randomBytes(16).toString("hex");

        // Hash password and salt using SHA-512 and set the `password` field of the current record
        this.setDataValue("password", crypto.pbkdf2Sync(
          value, this.salt,
          10000, KEY_PASSWORD_LEN,
          "sha512"
        ).toString("hex"));
      }
    },
    salt: {
      type: DataTypes.STRING,
      allowNull: false
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize,
    tableName: "users",
    underscored: true
  });
}
