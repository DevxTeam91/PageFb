import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.page.upsert({
    where: { pageId: '752790171249695' },
    update: { name: 'Flirt with Fortune' },
    create: {
      pageId: '752790171249695',
      name: 'Flirt with Fortune',
      accessToken: 'dev_page_access_token_12345',
      isActive: true,
    },
  });

  await prisma.page.upsert({
    where: { pageId: '884920193821042' },
    update: { name: 'Luxe Audio & Electronics' },
    create: {
      pageId: '884920193821042',
      name: 'Luxe Audio & Electronics',
      accessToken: 'dev_page_access_token_12345',
      isActive: true,
    },
  });

  await prisma.page.upsert({
    where: { pageId: '992817264810294' },
    update: { name: 'Nexus Digital Solutions' },
    create: {
      pageId: '992817264810294',
      name: 'Nexus Digital Solutions',
      accessToken: 'dev_page_access_token_12345',
      isActive: true,
    },
  });

  console.log('Successfully seeded 3 Facebook business pages!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
