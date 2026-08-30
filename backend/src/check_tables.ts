import { db } from './prisma/db.js';
async function main() {
  try {
    const users = await db.orm.public.User.all();
    console.log("Database tables are accessible! Users count:", users.length);
  } catch (e) {
    console.error("Database query failed:", e);
  }
  process.exit(0);
}
main();
