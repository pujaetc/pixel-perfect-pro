// File: /api/proxy.js (on your Vercel project)
import fetch from 'node-fetch';
import FormData from 'form-data';

export default async function handler(request, response) {
  // শুধুমাত্র POST অনুরোধ গ্রহণ করা হবে
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = request.body;
    const apiToCall = payload.api;

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
        
        // *** ভুলটি এখানে সংশোধন করা হয়েছে: মডেলের নাম ঠিক করা হয়েছে ***
        const apiFetch = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (!apiFetch.ok) {
            // Gemini থেকে আসা error মেসেজটি এখন টেক্সট হিসেবে ক্লায়েন্টকে পাঠানো হবে
            const errorText = await apiFetch.text();
            throw new Error(`Gemini API Error: ${errorText}`);
        }
        apiResponse = await apiFetch.json();
        break;
      }

      case "clipdrop-cleanup": {
        if (!clipdropApiKey) throw new Error("Server Error: ClipDrop API Key is not configured.");
        
        const formData = new FormData();
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
        
        const { base64Data, factor, width, height } = payload;
        
        const formData = new FormData();
        const imageBlob = new Blob([Buffer.from(base64Data, 'base64')], { type: 'image/jpeg' });
        formData.append('image_file', imageBlob, 'image.jpg');
        
        // ** আপস্কেলের জন্য সঠিক যুক্তি **
        if (width && height) {
            formData.append('target_width', String(Math.round(width)));
            formData.append('target_height', String(Math.round(height)));
        } 
        else if (factor) {
            formData.append('scale', String(factor));
        } 
        else {
            throw new Error("Server Error: Either 'factor' or 'width'/'height' must be provided for upscaling.");
        }

        const apiFetch = await fetch('https://clipdrop-api.co/super-resolution/v1', {
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

    return response.status(200).json(apiResponse);

  } catch (error) {
    console.error('Server-side error:', error);
    // সার্ভারের error মেসেজটি ক্লায়েন্টকে পাঠানো হচ্ছে
    return response.status(500).json({ error: error.message });
  }
}
