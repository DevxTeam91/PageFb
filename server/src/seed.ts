import { prisma } from './db';
import { graphApiClient } from './services/graphApi';

async function run() {
  const p1Token = 'EAAYjtThbgB0BSJDjLSvoMYNJ569w2ixBsovPbO7BapMZCAJHxepttSEl0ZAvTItnlZC27YiYGY45F4JwTWsp0wmqz0ZBM61P9Gsbnics8EM19DDGveQ5WXZAYcVG3bmT7bNItioUKsmMUQsp9hiLCUPFSPxNDY0T9NcgfZBxSHDxHSAzP5QZBmHbFQ7eJSeshrZC4dlFRlEuazf6UltOLxklo6tNhiWWCNHADdl17arqTVnyXfdd7hx88GYZD';
  const p2Token = 'EAAYjtThbgB0BSO0l49w7JczVSYgODfNqXSEUlvZBtDu8RwencbZCZCJjY7DTpdYkeOBZBSYq97IfTxW5suH447LKfaBlLjzwkQTVRZBSP2lk0ZB7tbb3PUwLQVZAAZCGqIVe8Oh2I28eXL2emCVifsJrYlOgBMF30jc6OJ6D36jlnoopVgfe8tJ25tKV3k6eVnarsq3JiVT7ilzk7F692W3iPCZCX9XQ0b5OyUji6z0ADFEJdDa4UK6oO0bcZD';

  console.log('Fetching details for P1...');
  const p1 = await graphApiClient.getPageDetails(p1Token);
  if (p1.id) {
    await prisma.page.upsert({
      where: { pageId: p1.id },
      update: { accessToken: p1Token, isActive: true, name: p1.name },
      create: { pageId: p1.id, accessToken: p1Token, name: p1.name, isActive: true }
    });
    console.log('Subscribing P1 to webhook...');
    const res = await graphApiClient.subscribePageToWebhook(p1Token);
    console.log(res);
  }

  console.log('Fetching details for P2...');
  const p2 = await graphApiClient.getPageDetails(p2Token);
  if (p2.id) {
    await prisma.page.upsert({
      where: { pageId: p2.id },
      update: { accessToken: p2Token, isActive: true, name: p2.name },
      create: { pageId: p2.id, accessToken: p2Token, name: p2.name, isActive: true }
    });
    console.log('Subscribing P2 to webhook...');
    const res = await graphApiClient.subscribePageToWebhook(p2Token);
    console.log(res);
  }

  console.log('All pages inserted and subscribed!');
}

run().catch(console.error).finally(() => process.exit(0));
