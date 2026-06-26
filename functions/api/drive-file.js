import { jsonErr } from '../_helpers.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fileId = url.searchParams.get('id');

  if (!fileId) {
    return jsonErr('Missing file id', 400);
  }

  const apiKey = context.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return jsonErr('Missing GOOGLE_DRIVE_API_KEY', 500);
  }

  try {
    const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return jsonErr('Failed to fetch file from Google Drive: ' + response.statusText, response.status);
    }

    // Forward the file with CORS headers to allow frontend access
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    
    return new Response(response.body, {
      status: response.status,
      headers: headers
    });

  } catch (error) {
    return jsonErr('Error fetching file: ' + error.message, 500);
  }
}
