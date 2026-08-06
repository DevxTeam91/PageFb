import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.page.findMany().then(pages => console.log('PAGES:', JSON.stringify(pages))).finally(() => prisma.$disconnect());
