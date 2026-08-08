import { PrismaClient } from '@prisma/client';
import { decryptToken } from './server/src/utils/crypto';

const prisma = new PrismaClient();

async function test() {
  const page = await prisma.page.findFirst({ where: { isActive: true, accessToken: { not: '' } } });
  if (!page) return console.log("No page");

  const token = decryptToken(page.accessToken);
  const pageId = page.pageId;
  
  // Find a conversation
  const conv = await prisma.conversation.findFirst({ where: { pageId: page.id } });
  if (!conv) return console.log("No conversation");

  const psid = conv.psid;
  
  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?user_id=${psid}&fields=participants&access_token=${token}`;
  console.log("Fetching:", url.replace(token, 'TOKEN'));
  
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
