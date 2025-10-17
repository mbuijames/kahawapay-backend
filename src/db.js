// kahawapay-backend/src/db.js
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing in .env file!");
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: console.log, // ✅ See queries in console
  benchmark: true,      // ✅ See query execution times
});

console.log("Connecting to DB with URL:", process.env.DATABASE_URL);

export default sequelize;
