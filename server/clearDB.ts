import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.page.updateMany({ data: { lastSyncedAt: null } });
  console.log('Cleared DB to force fresh sync');
}
main().finally(() => prisma.$disconnect());
