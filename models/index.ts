import { Sequelize } from "sequelize";
import initUser from "./user";

export default async function setupDatabase(sequelize: Sequelize) {
  initUser(sequelize);
  await sequelize.sync()
}
