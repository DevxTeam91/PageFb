import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import {
  sendManualReply,
  toggleConversationAutoReply,
  markConversationRead,
  backfillFromGraphApi,
} from '../services/conversations';

const router = Router();

// Ensure uploads folder exists
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup Multer for media uploads (images and videos up to 25MB)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `media-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
});

/**
 * GET /api/conversations
 * List conversations optionally filtered by pageId or search query
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const pageId = req.query.pageId as string | undefined;
    const since = req.query.since as string | undefined;

    const where: any = {};

    if (since) {
      where.updatedAt = { gte: new Date(parseInt(since, 10)) };
    }

    if (pageId && pageId !== 'all') {
      where.pageId = pageId;
    }

    if (search) {
      where.OR = [
        { userName: { contains: search } },
        { psid: { contains: search } },
        { messages: { some: { text: { contains: search } } } },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        page: {
          select: { id: true, name: true, pageId: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const formatted = conversations.map((conv) => ({
      id: conv.id,
      psid: conv.psid,
      userName: conv.userName,
      userAvatarUrl: conv.userAvatarUrl,
      lastMessageAt: conv.lastMessageAt,
      autoReplyEnabled: conv.autoReplyEnabled,
      unread: conv.unread,
      pageId: conv.pageId,
      page: conv.page,
      createdAt: conv.createdAt,
      lastMessage: conv.messages[0] || null,
    }));

    return res.json({ conversations: formatted });
  } catch (err: any) {
    console.error('[API] Error fetching conversations:', err);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Full chat history for a conversation.
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { page: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ conversation, messages });
  } catch (err: any) {
    console.error('[API] Error fetching conversation messages:', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/conversations/:id/reply
 * Send manual reply to a conversation (supports text and/or photo/video upload).
 */
router.post('/:id/reply', upload.single('media'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const text = req.body.text as string | undefined;
    const mediaUrl = req.body.mediaUrl as string | undefined;
    const file = req.file;

    console.log(`[DEBUG] POST /api/conversations/${id}/reply received.`);
    console.log(`[DEBUG] Request body (excluding file buffer):`, { text, mediaUrl, hasFile: !!file });

    if (!text && !file && !mediaUrl) {
      console.log(`[DEBUG] Error: Message text or media file is required`);
      return res.status(400).json({ error: 'Message text or media file is required' });
    }

    let mediaFile: { buffer: Buffer; originalname: string; mimetype: string; localUrl: string } | undefined;

    if (file) {
      const fileBuffer = fs.readFileSync(file.path);
      mediaFile = {
        buffer: fileBuffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        localUrl: `/uploads/${file.filename}`,
      };
    } else if (mediaUrl) {
      mediaFile = {
        buffer: Buffer.from(''),
        originalname: 'attachment.jpg',
        mimetype: 'image/jpeg',
        localUrl: mediaUrl,
      };
    }

    const result = await sendManualReply(id, text, mediaFile);
    return res.status(201).json(result);
  } catch (err: any) {
    console.error('[API] Error sending manual reply:', err);
    return res.status(500).json({ error: err.message || 'Failed to send reply' });
  }
});

/**
 * PATCH /api/conversations/:id/auto-reply
 * Toggle auto-reply mute status for a specific conversation.
 */
router.patch('/:id/auto-reply', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const updated = await toggleConversationAutoReply(id, enabled);
    return res.json({ conversation: updated });
  } catch (err: any) {
    console.error('[API] Error toggling auto-reply:', err);
    return res.status(500).json({ error: err.message || 'Failed to toggle auto-reply' });
  }
});

/**
 * POST /api/conversations/:id/read
 * Mark conversation as read.
 */
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await markConversationRead(id);
    return res.json({ conversation: updated });
  } catch (err: any) {
    console.error('[API] Error marking conversation as read:', err);
    return res.status(500).json({ error: err.message || 'Failed to mark as read' });
  }
});

/**
 * POST /api/conversations/read-all
 * Mark all conversations as read for a given page (or all pages).
 */
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const pageId = req.body?.pageId as string | undefined;
    const where: any = {};
    if (pageId && pageId !== 'all') {
      where.pageId = pageId;
    }
    await prisma.conversation.updateMany({
      where,
      data: { unread: false },
    });
    // We do not emit for every single conversation to avoid socket flooding.
    // The clients can refetch or just optimistically update.
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[API] Error marking all as read:', err);
    return res.status(500).json({ error: err.message || 'Failed to mark all as read' });
  }
});

/**
 * POST /api/sync
 * Trigger full conversation history backfill from Facebook Graph API.
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const pageId = req.body?.pageId as string | undefined;
    const force = req.body?.force === true;
    
    if (force) {
      console.log('[API] Forcing full sync: clearing DB...');
      await prisma.message.deleteMany({});
      await prisma.conversation.deleteMany({});
      await prisma.page.updateMany({
        where: pageId ? { pageId } : {},
        data: { lastSyncedAt: null },
      });
    }

    const result = await backfillFromGraphApi(pageId, !force);
    return res.json(result);
  } catch (err: any) {
    console.error('[API] Error syncing conversations:', err);
    return res.status(500).json({ error: err.message || 'Failed to sync conversations' });
  }
});

export default router;
