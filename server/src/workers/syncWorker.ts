import { backfillFromGraphApi } from '../services/conversations';

// BullMQ Disabled locally if Redis is not running
export async function initializeSyncCron() {
  console.log('[BullMQ] Disabled locally.');
}
export const syncWorker = null;
export const syncQueue = null;
