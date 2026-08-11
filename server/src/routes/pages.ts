import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { fetchAllPagesFromToken } from '../utils/tokenExchanger';
import { encryptToken } from '../utils/crypto';

const router = Router();

function persistTokenToEnv(token: string) {
  try {
    const envPath = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('PAGE_ACCESS_TOKEN=')) {
        content = content.replace(/PAGE_ACCESS_TOKEN=.*/g, `PAGE_ACCESS_TOKEN="${token.replace(/\n/g, '')}"`);
      } else {
        content += `\nPAGE_ACCESS_TOKEN="${token}"\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
  } catch (e: any) {
    console.warn('[Pages] Could not update .env token:', e.message);
  }
}

/**
 * GET /api/pages
 * List all configured Facebook pages with status & stats
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    let pages = await prisma.page.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    // Seed default 3 business pages if database is empty
    if (pages.length === 0) {
      await prisma.page.createMany({
        data: [
          {
            pageId: '752790171249695',
            name: 'Flirt with Fortune',
            accessToken: 'dev_page_access_token_12345',
            isActive: true,
          },
          {
            pageId: '884920193821042',
            name: 'Luxe Audio & Electronics',
            accessToken: 'dev_page_access_token_12345',
            isActive: true,
          },
          {
            pageId: '992817264810294',
            name: 'Nexus Digital Solutions',
            accessToken: 'dev_page_access_token_12345',
            isActive: true,
          },
        ],
      });

      pages = await prisma.page.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          _count: {
            select: {
              conversations: true,
            },
          },
        },
      });
    }

    const enrichedPages = await Promise.all(
      pages.map(async (page) => {
        const unreadCount = await prisma.conversation.count({
          where: { pageId: page.id, unread: true },
        });

        return {
          id: page.id,
          pageId: page.pageId,
          name: page.name,
          pictureUrl: page.pictureUrl,
          isActive: page.isActive,
          totalConversations: page._count.conversations,
          unreadConversations: unreadCount,
          createdAt: page.createdAt,
        };
      })
    );

    return res.json(enrichedPages);
  } catch (err: any) {
    console.error('[API] Error listing pages:', err);
    return res.status(500).json({ error: 'Failed to list pages' });
  }
});

/**
 * POST /api/pages
 * Add/Import Facebook pages using Access Token (fetches ALL business pages & permanently stores tokens)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { token, appId, appSecret } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    // 1. Fetch ALL business pages accessible via /me/accounts
    const discoveredPages = await fetchAllPagesFromToken(token);

    if (!discoveredPages || discoveredPages.length === 0) {
      return res.status(400).json({ error: 'No Facebook Pages found associated with this token' });
    }

    const savedPages = [];
    for (const p of discoveredPages) {
      const encryptedToken = encryptToken(p.accessToken);
      // Encrypt appSecret if provided
      const encryptedSecret = appSecret ? encryptToken(appSecret) : undefined;

      const page = await prisma.page.upsert({
        where: { pageId: p.pageId },
        update: {
          name: p.name,
          accessToken: encryptedToken,
          ...(p.pictureUrl && { pictureUrl: p.pictureUrl }),
          ...(encryptedSecret && { appSecret: encryptedSecret }),
          isActive: true,
        },
        create: {
          pageId: p.pageId,
          name: p.name,
          accessToken: encryptedToken,
          pictureUrl: p.pictureUrl,
          appSecret: encryptedSecret,
          isActive: true,
        },
      });

      // Auto-subscribe page to webhooks
      try {
        const subUrl = `https://graph.facebook.com/v19.0/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes&access_token=${encodeURIComponent(p.accessToken)}`;
        const subRes = await fetch(subUrl, { method: 'POST' });
        const subJson: any = await subRes.json();
        if (!subRes.ok || !subJson.success) {
          console.error(`[API] Failed to subscribe page ${p.name} to webhook:`, subJson);
        } else {
          console.log(`[API] Successfully subscribed page ${p.name} to webhook.`);
        }
      } catch (err: any) {
        console.error(`[API] Network error subscribing page ${p.name} to webhook:`, err);
      }

      savedPages.push({
        id: page.id,
        pageId: page.pageId,
        name: page.name,
        pictureUrl: page.pictureUrl,
        isActive: page.isActive,
      });
    }

    return res.status(201).json({
      success: true,
      count: savedPages.length,
      page: savedPages[0],
      pages: savedPages,
    });
  } catch (err: any) {
    console.error('[API] Error adding pages:', err);
    return res.status(500).json({ error: err.message || 'Failed to add Facebook pages' });
  }
});

/**
 * PATCH /api/pages/:id
 * Update page settings or toggle status
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, isActive, accessToken } = req.body;

    if (accessToken) {
      persistTokenToEnv(accessToken.trim());
    }

    const page = await prisma.page.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
        ...(accessToken !== undefined && { accessToken }),
      },
    });

    return res.json({ success: true, page });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update page' });
  }
});

/**
 * DELETE /api/pages/:id
 * Remove page
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const count = await prisma.page.count();
    if (count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining page' });
    }

    await prisma.page.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete page' });
  }
});

export default router;
