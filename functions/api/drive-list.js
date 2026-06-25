import { jsonOk, jsonErr } from '../_helpers.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const urls = body.urls || [];
    
    if (!urls || urls.length === 0) {
      return jsonOk({ files: [] });
    }

    const apiKey = context.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) {
      return jsonErr('โปรดระบุ GOOGLE_DRIVE_API_KEY ใน Settings ของ Cloudflare Pages เพื่อใช้งานฟีเจอร์นี้');
    }

    const extractFolderId = (url) => {
      const match = url.match(/[-\w]{25,}/);
      return match ? match[0] : null;
    };

    let allFiles = [];

    // Process all provided URLs
    for (const url of urls) {
      const folderId = extractFolderId(url);
      if (!folderId) continue;

      const apiUrl = \`https://www.googleapis.com/drive/v3/files?q='\${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=\${apiKey}\`;
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.files) {
          // Add files and map them to our song format
          const mappedFiles = data.files
            .filter(f => f.mimeType === 'application/pdf' || f.mimeType.startsWith('image/'))
            .map(f => ({
              id: 'gdrive_' + f.id,
              name: f.name.replace(/\.[^/.]+$/, ""), // remove extension
              url: \`/api/drive-file?id=\${f.id}\`, // proxy URL to bypass CORS
              mime_type: f.mimeType,
              isDrive: true,
              created_at: new Date().toISOString()
            }));
          allFiles = allFiles.concat(mappedFiles);
        }
      }
    }

    return jsonOk({ files: allFiles });
  } catch (error) {
    return jsonErr('เกิดข้อผิดพลาดในการดึงไฟล์จาก Google Drive: ' + error.message, 500);
  }
}
