const { initializeDatabase } = require('./dist/main/database.js');
async function test() {
  try {
    const db = await initializeDatabase();
    console.log("DB Init Success!");
  } catch(e) {
    console.error("DB Init Failed:", e);
  }
}
test();
