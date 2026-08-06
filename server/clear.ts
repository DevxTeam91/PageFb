import { config } from 'dotenv';
config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.page.updateMany({ data: { lastSyncedAt: null } }).then(() => console.log('Cleared lastSyncedAt')).finally(() => prisma.$disconnect());
