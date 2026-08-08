import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const msgs = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  for (const m of msgs) {
    console.log(`Msg: text="${m.text?.substring(0,20)}" dir=${m.direction} fbId=${m.fbMessageId}`);
  }
}
check();
