const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
require('dotenv').config({ path: './server/.env' }); // Wait, railway ENV? No, I will just log the token if possible. Wait, the DB is hosted on Neon.

async function run() {
  const pages = await prisma.page.findMany();
  console.log("Pages in DB:", pages.length);
  for (const page of pages) {
    console.log(`- ${page.name} (${page.pageId})`);
    
    // Test the Facebook subscription
    // I need the raw unencrypted token or I can just print it.
  }
}
run();
