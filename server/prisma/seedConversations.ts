import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pages = await prisma.page.findMany();
  const primaryPage = pages[0] || { id: 'cmsfbnc5j0000dtde9a6dpamz' };

  const customers = [
    {
      psid: '1001',
      name: 'Sarah Jenkins',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      messages: [
        { text: '👋 Hi! What are your pricing plans?', direction: 'inbound', minutesAgo: 25 },
        { text: '👋 Hi! Our pricing plans start at $49/month. You can view all features on our website or reply with your specific requirements!', direction: 'outbound_auto', minutesAgo: 24 },
        { text: 'Great, thanks for the quick reply!', direction: 'inbound', minutesAgo: 5 },
      ],
    },
    {
      psid: '1002',
      name: 'David Miller',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      messages: [
        { text: 'What are your support hours?', direction: 'inbound', minutesAgo: 45 },
        { text: '🕒 Our team is available Monday - Friday, 9:00 AM to 6:00 PM EST. Messages outside these hours are queued and answered promptly!', direction: 'outbound_auto', minutesAgo: 44 },
      ],
    },
    {
      psid: '1003',
      name: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      messages: [
        { text: 'Hello, I have a question regarding my order.', direction: 'inbound', minutesAgo: 180 },
        { text: '🛠️ Need help? Please describe the issue you are experiencing, and our support team will assist you right away.', direction: 'outbound_auto', minutesAgo: 179 },
      ],
    },
    {
      psid: '1004',
      name: 'Marcus Vance',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
      messages: [
        { text: 'Can I get a custom quote for enterprise features?', direction: 'inbound', minutesAgo: 720 },
      ],
    },
  ];

  for (const c of customers) {
    const conv = await prisma.conversation.upsert({
      where: { id: `conv_${c.psid}` },
      update: {
        userName: c.name,
        userAvatarUrl: c.avatar,
        lastMessageAt: new Date(Date.now() - c.messages[c.messages.length - 1].minutesAgo * 60 * 1000),
      },
      create: {
        id: `conv_${c.psid}`,
        psid: c.psid,
        userName: c.name,
        userAvatarUrl: c.avatar,
        pageId: primaryPage.id,
        autoReplyEnabled: true,
        unread: true,
        lastMessageAt: new Date(Date.now() - c.messages[c.messages.length - 1].minutesAgo * 60 * 1000),
      },
    });

    for (let i = 0; i < c.messages.length; i++) {
      const m = c.messages[i];
      await prisma.message.upsert({
        where: { fbMessageId: `msg_${c.psid}_${i}` },
        update: { text: m.text },
        create: {
          conversationId: conv.id,
          direction: m.direction,
          text: m.text,
          fbMessageId: `msg_${c.psid}_${i}`,
          createdAt: new Date(Date.now() - m.minutesAgo * 60 * 1000),
        },
      });
    }
  }

  console.log('Successfully seeded conversations and messages!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
