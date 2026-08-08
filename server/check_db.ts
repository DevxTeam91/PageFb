import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const convs = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: 5
  });
  console.log("Recent Conversations:");
  for (const c of convs) {
    console.log(`- [${c.id}] psid=${c.psid} userName="${c.userName}"`);
    const msgs = await prisma.message.findMany({
      where: { conversationId: c.id },
      orderBy: { timestamp: 'desc' },
      take: 3
    });
    for (const m of msgs) {
      console.log(`   -> msg: text="${m.text?.substring(0, 20)}" fbMessageId=${m.fbMessageId} isFromCustomer=${m.isFromCustomer} direction=${m.direction}`);
    }
  }
}
check();
