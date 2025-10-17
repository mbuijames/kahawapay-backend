"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Drop old foreign key if exists
    await queryInterface.removeConstraint("transactions", "transactions_user_id_fkey");

    // Step 2: Make user_id nullable
    await queryInterface.changeColumn("transactions", "user_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Step 3: Re-add FK with ON DELETE SET NULL
    await queryInterface.addConstraint("transactions", {
      fields: ["user_id"],
      type: "foreign key",
      name: "transactions_user_id_fkey",
      references: {
        table: "users",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    // Reverse changes

    // Drop new FK
    await queryInterface.removeConstraint("transactions", "transactions_user_id_fkey");

    // Make user_id NOT NULL again
    await queryInterface.changeColumn("transactions", "user_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Re-add original FK
    await queryInterface.addConstraint("transactions", {
      fields: ["user_id"],
      type: "foreign key",
      name: "transactions_user_id_fkey",
      references: {
        table: "users",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },
};
