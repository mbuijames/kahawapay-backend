// src/models/Transaction.js
import { DataTypes } from "sequelize";
import sequelize from "../db.js";

const Transaction = sequelize.define("Transaction", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  guest_identifier: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  recipient_msisdn: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  amount_usd: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  amount_crypto_btc: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
    defaultValue: 0,
  },
  fee_total: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0,
  },
  recipient_amount: {
    type: DataTypes.DECIMAL,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: "USD",
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: "pending",
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "transactions",
  schema: "public",
  timestamps: false,
});

export default Transaction;
