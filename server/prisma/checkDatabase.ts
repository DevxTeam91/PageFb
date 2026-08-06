import { prisma } from '../src/db';

async function main() {
  const messages = await prisma.message.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' },
    include: {
      conversation: true,
    },
  });

  console.log('--- DB MESSAGES AUDIT ---');
  for (const m of messages) {
    console.log(`[MSG ID: ${m.id}] User: ${m.conversation.userName} | Direction: ${m.direction} | Text: "${m.text}" | Attachments: ${m.attachments}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
