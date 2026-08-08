const token = 'EAAVJv0N7fgoBSAI3EfkQtcSlFIIxC0hmnakMU9a4uPwgZAEm5RxxZBJtm6PCUel90rSlqrcUHYhSmXju2LWo8Jj2uz8leHuFixeNbY306iP32KSxA0VZAO1WPKyiBnkMWz4QkER2QLiKuCwcsUCVOyvZBwZBwfzqm50GabE6wLHHW9ZAtLxGBc8exRcv3EvCshOnXZCIrGZCLuAgNlQTGlWfZAtdbbXmWLJvyD8RZA3D9G0FM61nBheZAxIz7Vp8UmuXoC9ZBJ1tf4DkQx4o2CEr3rvHydcnEaw9jW8LhwZDZD';
const pageId = '752790171249695'; // Flirt with fortune (from graphApi.ts mock)

// We need a real customer PSID. 
// Let's first fetch all conversations for the page to get a real PSID.
async function test() {
  console.log("Fetching conversations to find a customer PSID...");
  const convUrl = `https://graph.facebook.com/v19.0/${pageId}/conversations?access_token=${token}`;
  
  const res = await fetch(convUrl);
  const data = await res.json();
  
  if (!data.data || data.data.length === 0) {
    return console.log("No conversations found.");
  }

  // Let's pick a random conversation and fetch its participants
  let targetPsid = null;
  let targetName = null;

  for (const conv of data.data) {
     const pUrl = `https://graph.facebook.com/v19.0/${conv.id}?fields=participants&access_token=${token}`;
     const pRes = await fetch(pUrl);
     const pData = await pRes.json();
     if (pData.participants && pData.participants.data) {
        const customer = pData.participants.data.find((p: any) => p.id !== pageId);
        if (customer) {
            targetPsid = customer.id;
            targetName = customer.name;
            console.log(`Found a conversation!`);
            console.log(`Conversation ID: ${conv.id}`);
            console.log(`Customer PSID: ${targetPsid}`);
            console.log(`Customer Name via /participants: ${targetName}`);
            break;
        }
     }
  }

  if (!targetPsid) {
    return console.log("Could not find a customer PSID.");
  }

  console.log("\n--- TEST 1: Standard User Profile API ---");
  const profileUrl = `https://graph.facebook.com/v19.0/${targetPsid}?fields=first_name,last_name,name,profile_pic&access_token=${token}`;
  const profileRes = await fetch(profileUrl);
  const profileData = await profileRes.json();
  console.log("Standard Profile Result:", JSON.stringify(profileData, null, 2));

  console.log("\n--- TEST 2: /me/conversations Fallback API ---");
  const fallbackUrl = `https://graph.facebook.com/v19.0/me/conversations?user_id=${targetPsid}&fields=participants&access_token=${token}`;
  const fallbackRes = await fetch(fallbackUrl);
  const fallbackData = await fallbackRes.json();
  console.log("Fallback Result:", JSON.stringify(fallbackData, null, 2));
}

test();
