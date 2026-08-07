import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const deviceSchema = z.object({
  token: z.string(),
  pageId: z.string().optional()
});

router.post('/token', async (req: Request, res: Response) => {
  try {
    const { token, pageId } = deviceSchema.parse(req.body);

    const device = await prisma.device.upsert({
      where: { token },
      update: { pageId, updatedAt: new Date() },
      create: { token, pageId }
    });

    res.status(200).json({ success: true, device });
  } catch (error) {
    console.error('[Device API] Failed to register token:', error);
    res.status(400).json({ error: 'Invalid payload' });
  }
});

router.delete('/token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    await prisma.device.delete({ where: { token } });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Device API] Failed to delete token:', error);
    res.status(400).json({ error: 'Failed to delete' });
  }
});

export default router;
