const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.conversation.updateMany({
    data: { unread: false },
  });
  console.log(`Updated ${result.count} conversations to read.`);
}
main().finally(() => prisma.$disconnect());
