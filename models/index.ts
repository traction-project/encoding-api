import { Sequelize } from "sequelize";
import initUser from "./user";

/**
 * Sets up the database by mounting all the models and syncing them with the
 * database.
 *
 * @param sequelize A Sequelize instance with an open database connection
 */
export default async function setupDatabase(sequelize: Sequelize) {
  // Initialise user model
  initUser(sequelize);

  // Synchronise models with database
  await sequelize.sync();
}
