const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.page.update({
    where: { pageId: '752790171249695' },
    data: { accessToken: 'EAAYjtThbgB0BSHQ5ep4QpMSIQju3xZBK1rcsYOkqXcbc4Vqomaj7JbqR1XdYZBCATsTEfAmjuUm9ZARTuBjOKuihoblVjwIKMIxIWlcKbXMDYxyZB0ezWpU1xpyrKuZBfyFS1gq2qmsyIMC7iue1SJy2TKyZCiZAAzPO0h9RLZCfWClvPZCV5yIedUxZCsT0VUEUw4j0tgy2f2MrYmhDy75QWFjQtxCaSgIgZCR7eemRnndo7qs8huJAt6JctruKQ8ZD' }
  }).catch(() => console.log('Flirt page not found'));

  await prisma.page.update({
    where: { pageId: '884920193821042' },
    data: { accessToken: 'EAAYjtThbgB0BSBxJZAAKK2uiIr4ZAfs4xqgnuAsVES7ssk9ZCbcQdy8rzOWfe5x1y2CoiKA4BnQTfTACkS1LEyu1Ua017QrUpDDVNqACc4FJuzGMMnRkP3LxADVJAeQf9mXAyjUFbK85WiNe407gZCZBk09pDpOLfJzRIJ303RkEvoo76axIkDaUvMZCaaJGn63ZCNAyUrgXw61A219PgFDz5NvmT7vz2ZAxoFeuY2MG8byb4hxkmNVq1qZCYeGsZD' }
  }).catch(() => console.log('Jackpot page not found'));

  console.log('Tokens updated successfully');
}

main().finally(() => prisma.$disconnect());
