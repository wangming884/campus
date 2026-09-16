require('dotenv').config();

const { DatabaseSync } = require('node:sqlite');
const mysql = require('mysql2/promise');
const path = require('path');
const { initDatabase } = require('../src/db/database');

const tables = [
  'users',
  'portal_config',
  'club_documents',
  'application_templates',
  'membership_applications',
  'notices',
  'mail_logs',
  'system_settings',
  'email_verification_codes',
  'site_pages',
  'member_messages',
  'activity_proposals',
  'proposal_votes',
  'development_directions',
  'activity_categories',
  'role_applications'
];

function quoteIdentifier(identifier) {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

async function main() {
  process.env.USE_SQLITE = 'false';

  const sqlite = new DatabaseSync(path.join(__dirname, '..', 'data', 'campus_club.db'));
  const initialized = await initDatabase();
  if (!initialized) {
    throw new Error('MySQL 初始化失败，未执行迁移');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'campus_club'
  });

  const summary = [];
  try {
    await connection.beginTransaction();
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
      const rows = sqlite.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all();
      if (columns.length === 0) throw new Error(`SQLite 表不存在: ${table}`);

      await connection.query(`TRUNCATE TABLE ${quoteIdentifier(table)}`);
      if (rows.length > 0) {
        const names = columns.map(column => quoteIdentifier(column.name)).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const insert = `INSERT INTO ${quoteIdentifier(table)} (${names}) VALUES (${placeholders})`;
        for (const row of rows) {
          await connection.execute(insert, columns.map(column => row[column.name]));
        }
      }
      const [countRows] = await connection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`);
      summary.push({ table, sqlite: rows.length, mysql: Number(countRows[0].count) });
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
    sqlite.close();
  }

  for (const item of summary) {
    if (item.sqlite !== item.mysql) {
      throw new Error(`迁移数量不一致: ${item.table} SQLite=${item.sqlite}, MySQL=${item.mysql}`);
    }
    console.log(`${item.table}: ${item.mysql}`);
  }
  console.log('SQLite -> MySQL 迁移完成');
}

main().catch(error => {
  console.error(`迁移失败: ${error.message}`);
  process.exitCode = 1;
});