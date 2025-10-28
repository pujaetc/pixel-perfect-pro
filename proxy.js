export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = request.body;
    const apiToCall = payload.api;
    
    // আপনার গোপন API কী এখানে Environment Variable থেকে আসবে
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const clipdropApiKey = process.env.CLIPDROP_API_KEY;

    let apiResponse;

    if (apiToCall === "gemini") {
      if (!geminiApiKey) throw new Error("Gemini API Key is not configured.");
      
      const geminiPayload = {
        contents: [{ parts: [{ text: payload.prompt }, { inline_data: { mime_type: "image/jpeg", data: payload.base64Data } }] }],
        generationConfig: payload.expectJson ? { responseMimeType: "application/json" } : {}
      };
      
      const geminiFetch = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });
      if (!geminiFetch.ok) throw new Error(`Gemini API Error: ${await geminiFetch.text()}`);
      apiResponse = await geminiFetch.json();
    } 
    // এখানে else if দিয়ে ClipDrop এর কোড যোগ করা যাবে
    else {
      throw new Error("Invalid API specified.");
    }

    // ক্লায়েন্টকে সফলভাবে ফলাফল পাঠানো হচ্ছে
    return response.status(200).json(apiResponse);

  } catch (error) {
    console.error('Server-side error:', error);
    return response.status(500).json({ error: error.message });
  }
}