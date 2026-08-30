import { db } from './prisma/db.js';

async function main() {
  const emailToCheck = 'thakashiq@gmail.com';
  try {
    const user = await db.orm.public.User.where({ email: emailToCheck }).first();
    if (!user) {
      console.log(`User ${emailToCheck} not found.`);
      process.exit(0);
    }
    const integration = await db.orm.public.SlackIntegration.where({ userId: user.id }).first();
    console.log(`[Database Status] User: ${user.email}`);
    console.log(`[Database Status] Slack integration:`, integration);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
main();
