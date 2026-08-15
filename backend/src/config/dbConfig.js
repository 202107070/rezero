import "#config/envConfig.js";

import mariadb from "mariadb";

export const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
});

export async function testDbConnection() {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.query("SELECT 1");
    console.log("[MariaDB] connected");
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
