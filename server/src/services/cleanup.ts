import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Deletes messages older than 30 days to free up SQLite database space.
 */
export async function cleanOldData() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`[Cleanup] Starting auto-cleanup for messages older than ${thirtyDaysAgo.toISOString()}...`);

    const result = await prisma.message.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    console.log(`[Cleanup] Successfully deleted ${result.count} old messages.`);
  } catch (error) {
    console.error('[Cleanup] Failed to clean old data:', error);
  }
}
