import { database } from '../database';
import { PendingQueue } from '../database/models/PendingQueue';
import * as api from './api';
import { NetworkObserver } from './NetworkObserver';

class OfflineQueueService {
  private isFlushing = false;

  constructor() {
    // Automatically try to flush when network returns
    NetworkObserver.subscribe((isConnected) => {
      if (isConnected) {
        this.flush();
      }
    });
  }

  /**
   * Enqueue a new message to be sent
   */
  async enqueue(conversationId: string, pageId: string, text: string, attachmentsJson?: string) {
    console.log('[OfflineQueue] Enqueuing message:', { conversationId, text });
    await database.write(async () => {
      await database.get<PendingQueue>('pending_queue').create(entry => {
        entry.conversationId = conversationId;
        entry.pageId = pageId;
        entry.text = text;
        entry.attachmentsJson = attachmentsJson;
        entry.retryCount = 0;
        entry.lastRetry = Date.now();
        entry.createdAt = Date.now();
        entry.status = 'pending';
      });
    });

    if (NetworkObserver.isOnline()) {
      this.flush();
    }
  }

  /**
   * Attempt to send all pending messages
   */
  async flush() {
    if (this.isFlushing || !NetworkObserver.isOnline()) return;
    this.isFlushing = true;

    try {
      const pendingItems = await database.get<PendingQueue>('pending_queue')
        .query()
        .fetch();

      const toProcess = pendingItems.filter(item => item.status === 'pending' || item.status === 'failed');

      if (toProcess.length === 0) {
        this.isFlushing = false;
        return;
      }

      console.log(`[OfflineQueue] Flushing ${toProcess.length} items...`);

      // Sort by creation time to maintain send order
      toProcess.sort((a, b) => a.createdAt - b.createdAt);

      for (const item of toProcess) {
        if (!NetworkObserver.isOnline()) {
          console.log('[OfflineQueue] Network lost during flush. Aborting.');
          break;
        }

        // Calculate backoff if failed previously
        if (item.status === 'failed') {
          // 1s, 2s, 5s, 15s, 30s, 60s
          const backoffSchedule = [1000, 2000, 5000, 15000, 30000, 60000];
          const delay = backoffSchedule[Math.min(item.retryCount, backoffSchedule.length - 1)];
          if (Date.now() - item.lastRetry < delay) {
             continue; // Not ready to retry yet
          }
        }

        await database.write(async () => {
          await item.update(i => {
            i.status = 'sending';
            i.lastRetry = Date.now();
            i.retryCount += 1;
          });
        });

        try {
          // NOTE: Currently api.sendReply expects just ID and text/attachments.
          // In an offline queue, we should probably pass a idempotency key or temporary ID 
          // so the server doesn't duplicate it.
          // For now, we just call the API.
          
          await api.sendReply(item.conversationId, item.text, item.attachmentsJson ? JSON.parse(item.attachmentsJson) : undefined);

          // Success - remove from queue
          await database.write(async () => {
            await item.destroyPermanently();
          });
          
          console.log(`[OfflineQueue] Successfully sent queued message for ${item.conversationId}`);
        } catch (error: any) {
          console.warn('[OfflineQueue] Failed to send queued message:', error);
          await database.write(async () => {
            await item.update(i => {
              i.status = 'failed';
              i.lastError = error.message || 'Unknown error';
            });
          });
        }
      }
    } catch (e) {
      console.error('[OfflineQueue] Fatal error during flush:', e);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Set up a periodic check for retries (for items stuck in 'failed' status)
   */
  startRetryTimer() {
    setInterval(() => {
      if (NetworkObserver.isOnline()) {
        this.flush();
      }
    }, 10000); // Check every 10 seconds if there's anything to flush
  }
}

export const OfflineQueue = new OfflineQueueService();
