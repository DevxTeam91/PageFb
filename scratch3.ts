import { PrismaClient } from '@prisma/client';
import { decryptToken } from './server/src/utils/crypto';

const prisma = new PrismaClient();

async function test() {
  const pages = await prisma.page.findMany({ where: { isActive: true, accessToken: { not: '' } } });
  
  for (const page of pages) {
     const convs = await prisma.conversation.findMany({ where: { pageId: page.id } });
     console.log(`Page: ${page.name} (${page.pageId})`);
     console.log(`Conversations: ${convs.length}`);
     if (convs.length > 0) {
        console.log(`First PSID: ${convs[0].psid}`);
        console.log(`First User: ${convs[0].userName}`);
        console.log(`Token: ${decryptToken(page.accessToken)}`);
     }
  }
}

test();
