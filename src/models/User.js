// src/models/User.js
import { DataTypes } from "sequelize";
import sequelize from "../db.js";
import bcrypt from "bcryptjs";

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },

  // allow null/empty for guests; we’ll hash only if non-empty and changed
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "user" },
  is_guest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

  // --- 2FA fields (fix for your login error) ---
  twofa_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  totp_secret:: { type: DataTypes.TEXT, allowNull: true },
  twofa_backup_codes: { type: DataTypes.JSONB, allowNull: true },
  twofa_verified_at: { type: DataTypes.DATE, allowNull: true },

  // Optional but often referenced
  email_verified_at: { type: DataTypes.DATE, allowNull: true },
  last_login_at: { type: DataTypes.DATE, allowNull: true },

  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: "users",
  timestamps: false, // keep as-is
});

// Hash password only when it exists and has changed
User.beforeSave(async (user) => {
  if (user.changed("password")) {
    const pwd = (user.password || "").trim();
    user.password = pwd ? await bcrypt.hash(pwd, 10) : "";
  }
});

export default User;
