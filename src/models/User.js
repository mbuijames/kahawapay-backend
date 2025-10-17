// src/models/User.js
import { DataTypes } from "sequelize";
import sequelize from "../db.js";
import bcrypt from "bcryptjs";

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: true }, // allow null/empty for guests
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "user" },
  is_guest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "users",
  timestamps: false,
});

User.beforeCreate(async (user) => {
  if (user.password && user.password.trim().length > 0) {
    user.password = await bcrypt.hash(user.password, 10);
  } else {
    user.password = ""; // or null, as long as DB allows it
  }
});

export default User;
