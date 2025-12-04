// db.js
import { Sequelize } from "sequelize";
import pg from "pg";  // required for Postgres
import dotenv from "dotenv";

dotenv.config();

// Ensure DATABASE_URL is set
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL is not set in .env");
  process.exit(1);
}

// Initialize Sequelize
const sequelize = new Sequelize(DB_URL, {
  dialect: "postgres",
  dialectModule: pg,
  protocol: "postgres",
  logging: false,       // set true to debug SQL queries
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // for Render or some cloud providers
    },
  },
});

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established successfully!");
  } catch (err) {
    console.error("❌ Unable to connect to the database:", err.message);
  }
};

testConnection();

export default sequelize;
