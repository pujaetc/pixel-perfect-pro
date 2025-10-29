export default async function handler(request, response) {
  // শুধুমাত্র POST অনুরোধ গ্রহণ করা হবে
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = request.body;
    const apiToCall = payload.api;

    // আপনার গোপন API কী Environment Variable থেকে লোড করা হচ্ছে
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const clipdropApiKey = process.env.CLIPDROP_API_KEY;
    
    let apiResponse;

    switch (apiToCall) {
      case "gemini": {
        if (!geminiApiKey) throw new Error("Server Error: Gemini API Key is not configured.");
        
        const geminiPayload = {
          contents: [{ parts: [{ text: payload.prompt }, { inline_data: { mime_type: "image/jpeg", data: payload.base64Data } }] }],
          generationConfig: payload.expectJson ? { responseMimeType: "application/json" } : {}
        };
        
        const apiFetch = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (!apiFetch.ok) throw new Error(`Gemini API Error: ${await apiFetch.text()}`);
        apiResponse = await apiFetch.json();
        break;
      }

      case "clipdrop-cleanup": {
        if (!clipdropApiKey) throw new Error("Server Error: ClipDrop API Key is not configured.");
        
        const formData = new FormData();
        // Base64 থেকে Blob তৈরি করা হচ্ছে
        const imageBlob = new Blob([Buffer.from(payload.imageBase64, 'base64')], { type: 'image/jpeg' });
        const maskBlob = new Blob([Buffer.from(payload.maskBase64, 'base64')], { type: 'image/png' });
        
        formData.append('image_file', imageBlob, 'image.jpg');
        formData.append('mask_file', maskBlob, 'mask.png');

        const apiFetch = await fetch('https://clipdrop-api.co/cleanup/v1', {
          method: 'POST',
          headers: { 'x-api-key': clipdropApiKey },
          body: formData,
        });

        if (!apiFetch.ok) throw new Error(`ClipDrop Cleanup API Error: ${await apiFetch.text()}`);
        const resultBlob = await apiFetch.blob();
        const buffer = Buffer.from(await resultBlob.arrayBuffer());
        apiResponse = { imageBase64: buffer.toString('base64') };
        break;
      }

      case "clipdrop-reimagine": {
        if (!clipdropApiKey) throw new Error("Server Error: ClipDrop API Key is not configured.");
        
        const formData = new FormData();
        const imageBlob = new Blob([Buffer.from(payload.imageBase64, 'base64')], { type: 'image/jpeg' });
        formData.append('image_file', imageBlob, 'image.jpg');

        const apiFetch = await fetch('https://clipdrop-api.co/reimagine/v1/reimagine', {
          method: 'POST',
          headers: { 'x-api-key': clipdropApiKey },
          body: formData,
        });

        if (!apiFetch.ok) throw new Error(`ClipDrop Reimagine API Error: ${await apiFetch.text()}`);
        const resultBlob = await apiFetch.blob();
        const buffer = Buffer.from(await resultBlob.arrayBuffer());
        apiResponse = { imageBase64: buffer.toString('base64') };
        break;
      }
      
     case "clipdrop-upscale": {
        if (!clipdropApiKey) throw new Error("Server Error: ClipDrop API Key is not configured.");
        
        const { base64Data, factor, originalWidth, originalHeight } = payload;
        const MAX_UPSCALE_DIMENSION = 4096;

        const rawTargetWidth = originalWidth * factor;
        const rawTargetHeight = originalHeight * factor;

        if (
          isNaN(rawTargetWidth) ||
          isNaN(rawTargetHeight) ||
          rawTargetWidth === 0 ||
          rawTargetHeight === 0
        ) {
            throw new Error("Invalid target dimensions calculated on server.");
        }

        const scaleAdjustment = Math.min(
          MAX_UPSCALE_DIMENSION / rawTargetWidth,
          MAX_UPSCALE_DIMENSION / rawTargetHeight,
          1
        );

        const targetWidth = Math.max(
          1,
          Math.min(
            MAX_UPSCALE_DIMENSION,
            Math.round(rawTargetWidth * scaleAdjustment)
          )
        );

        const targetHeight = Math.max(
          1,
          Math.min(
            MAX_UPSCALE_DIMENSION,
            Math.round(rawTargetHeight * scaleAdjustment)
          )
        );

        const formData = new FormData();
        const imageBlob = new Blob([Buffer.from(base64Data, 'base64')], { type: 'image/jpeg' });
        
        formData.append('image_file', imageBlob, 'image.jpg');
        
        // --- মূল সমাধান এখানেই ---
        // সংখ্যাগুলোকে স্ট্রিং-এ রূপান্তর করে append করা হচ্ছে
        formData.append('target_width', String(targetWidth));
        formData.append('target_height', String(targetHeight));

        const apiFetch = await fetch('https://clipdrop-api.co/image-upscaling/v1/upscale', {
          method: 'POST',
          headers: { 'x-api-key': clipdropApiKey },
          body: formData,
        });

        if (!apiFetch.ok) {
            const errorText = await apiFetch.text();
            throw new Error(`ClipDrop Upscale API Error: ${errorText}`);
        }

        const resultBlob = await apiFetch.blob();
        const buffer = Buffer.from(await resultBlob.arrayBuffer());
        apiResponse = { imageBase64: buffer.toString('base64') };
        break;
      }
      default:
        throw new Error("Invalid API specified.");
    }

    // ক্লায়েন্টকে সফলভাবে ফলাফল পাঠানো হচ্ছে
    return response.status(200).json(apiResponse);

  } catch (error) {
    console.error('Server-side error:', error);
    return response.status(500).json({ error: error.message });
  }
}
