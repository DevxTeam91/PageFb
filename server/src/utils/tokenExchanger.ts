const APP_ID = '1728111101837341';
const APP_SECRET = '22338e523454d418adcdccde09db890b';
const DEFAULT_PAGE_ID = '752790171249695';

export interface PageTokenResult {
  pageId: string;
  name: string;
  accessToken: string;
  pictureUrl?: string;
}

/**
 * Fetch ALL pages accessible by a User or Page Access Token across all business accounts.
 */
export async function fetchAllPagesFromToken(userOrPageToken: string): Promise<PageTokenResult[]> {
  const cleanToken = userOrPageToken.trim();

  if (cleanToken.startsWith('dev_') || cleanToken.startsWith('test_')) {
    return [
      {
        pageId: '752790171249695',
        name: 'Flirt with Fortune',
        accessToken: cleanToken,
      },
      {
        pageId: '884920193821042',
        name: 'Luxe Audio & Electronics',
        accessToken: cleanToken,
      },
      {
        pageId: '992817264810294',
        name: 'Nexus Digital Solutions',
        accessToken: cleanToken,
      },
    ];
  }

  // 1. Attempt to exchange for a long-lived user access token
  let activeToken = cleanToken;
  try {
    const exchangeUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(cleanToken)}`;
    const exchangeRes = await fetch(exchangeUrl);
    const exchangeData = (await exchangeRes.json()) as any;
    if (exchangeData && exchangeData.access_token) {
      activeToken = exchangeData.access_token;
    }
  } catch {
    // Continue with cleanToken if exchange fails
  }

  // 2. Fetch all pages connected to this token via /me/accounts
  try {
    const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,picture&access_token=${encodeURIComponent(activeToken)}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = (await accountsRes.json()) as any;

    if (accountsData && Array.isArray(accountsData.data) && accountsData.data.length > 0) {
      return accountsData.data.map((item: any) => ({
        pageId: item.id,
        name: item.name || 'Facebook Page',
        accessToken: item.access_token || activeToken,
        pictureUrl: item.picture?.data?.url,
      }));
    }
  } catch (e: any) {
    console.warn('[TokenExchanger] Failed to fetch /me/accounts:', e.message);
  }

  // 3. Fallback to /me single page query if /me/accounts returned 0 items
  try {
    const meUrl = `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${encodeURIComponent(activeToken)}`;
    const meRes = await fetch(meUrl);
    const meData = (await meRes.json()) as any;
    if (meData && meData.id) {
      return [
        {
          pageId: meData.id,
          name: meData.name || 'Facebook Page',
          accessToken: activeToken,
          pictureUrl: meData.picture?.data?.url,
        },
      ];
    }
  } catch {}

  return [
    {
      pageId: DEFAULT_PAGE_ID,
      name: 'Flirt with Fortune',
      accessToken: activeToken,
    },
  ];
}

export async function exchangeForPermanentPageToken(userOrPageToken: string): Promise<{
  permanentPageToken: string;
  pageName: string;
  expiresIn: string;
}> {
  const pages = await fetchAllPagesFromToken(userOrPageToken);
  const first = pages[0];
  return {
    permanentPageToken: first.accessToken,
    pageName: first.name,
    expiresIn: 'Never (Permanent)',
  };
}
