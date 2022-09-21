import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Sequelize, Model, InferAttributes, InferCreationAttributes, CreationOptional, DataTypes } from "sequelize";

import { getFromEnvironment } from "../util";

const [ SESSION_SECRET ] = getFromEnvironment("SESSION_SECRET");

interface UserToken {
  _id: string;
  username: string;
  token: string;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare username: string;
  declare password: string;
  declare salt: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  public validatePassword(password: string): boolean {
    const hashedPassword = crypto.pbkdf2Sync(
      password, this.salt!,
      10000, keyPasswordLeng,
      "sha512"
    ).toString("hex");

    return this.password == hashedPassword;
  }

  public generateToken(validityInDays = 60) {
    // Generate timestamp n days from now
    const now = new Date();
    const expirationDate = new Date().setDate(now.getDate() + validityInDays);

    return jwt.sign({
      id: this.id,
      username: this.username,
      exp: Math.floor(expirationDate / 1000)
    }, SESSION_SECRET);
  }

  public getAuth(): UserToken {
    return {
      _id: `${this.id}`,
      username: this.username,
      token: this.generateToken()
    };
  }
}

const keyPasswordLeng = 512;

export default function (sequelize: Sequelize) {
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
      type: DataTypes.STRING(keyPasswordLeng * 2),
      unique: true,
      set(this: User, value: string) {
        this.salt = crypto.randomBytes(16).toString("hex");

        this.setDataValue("password", crypto.pbkdf2Sync(
          value, this.salt,
          10000, keyPasswordLeng,
          "sha512"
        ).toString("hex"));
      }
    },
    salt: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  }, {
    sequelize
  });
}
