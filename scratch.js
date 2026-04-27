const { AsyncDB } = require('./main/AsyncDB');
const sqlite3 = require('better-sqlite3');
const { SQLiteAdapter } = require('./main/database-manager');

async function test() {
  const db = new AsyncDB(new sqlite3('./db.sqlite'));
  const adapter = new SQLiteAdapter(db);
  const p = await adapter.getPersonnel();
  console.log(p.slice(0, 1));
}
test().catch(console.error);
