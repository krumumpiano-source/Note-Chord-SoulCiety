import { jsonOk, jsonErr } from '../_helpers.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const songName = body.songName || '';
    
    if (!songName.trim()) {
      return jsonErr('กรุณาระบุชื่อเพลงที่ต้องการค้นหา', 400);
    }

    const apiKey = context.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      // Mock Data if no API Key
      const mockChords = `### คอร์ดเพลง: ${songName}
🚨 **โปรดทราบ:** ระบบยังไม่ได้ติดตั้งคีย์เชื่อมต่อ Gemini API ทำการจำลองคอร์ดเบื้องต้นดังนี้

[Intro] | C | Em | Am | F | (2x)

C            Em          Am
ยังคงรักเธอเสมอ เหมือนเดิมทุกวันเวลา
     F               Dm         G
ใจยังคอยถามหา สบตากับเธอในความฝัน

[Chorus]
C              Em
* ก็เพียงอยากขอ ให้เธอกลับมา
Am             F
มารับสายใยร่วมรัด ตะโกนบอกรักสักครา
Dm           G           C
ดั่งดาวและฟ้า ที่ไม่เคยแยกจากกัน`;

      return jsonOk({
        chords: mockChords,
        source: 'Chord Search Simulator'
      });
    }

    const prompt = `คุณคือผู้เชี่ยวชาญด้านดนตรีและโปรแกรมค้นหาคอร์ดเพลงไทยยอดนิยม กรุณาแสดงเนื้อเพลงพร้อมคอร์ดดนตรีของเพลง "${songName}" โดยอ้างอิงจากแหล่งสืบค้นยอดนิยม เช่น dochord, buck chord, หรือ chordtab ให้แม่นยำที่สุด

คำแนะนำการจัดรูปแบบให้สวยงามอ่านง่ายสำหรับนักดนตรี:
1. บอกคีย์ดนตรีหลัก (Key) จังหวะ (Tempo) และชื่อศิลปินของเพลงเด่นชัดที่ด้านบน
2. จัดวางคอร์ดให้อยู่เหนือคำร้องเยื้องในทึ่ที่สัญญลักษณ์คอร์ดควรจะขึ้นอย่างแม่นยำ
3. แสดงสัญญลักษณ์ส่วนต่างๆ เช่น [Intro], [Verse], [Chorus], [Solo], [Outro] และเส้นแบ่งห้องคอร์ด เช่น | C | G | Am | F | ให้ชัดเจน
4. แปลงโครงสร้างทั้งหมดให้อยู่ในบล็อกข้อความ Markdown เพื่อให้อ่านบนอุปกรณ์มือถือและแท็บเล็ตได้ถนัด
5. ลงท้ายด้วยแหล่งข้อมูลอ้างอิงเว็บไซต์ที่พบต้นฉบับจริง`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error('Gemini API error: ' + response.statusText);
    }

    const data = await response.json();
    const chordsText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่พบข้อมูลคอร์ดดนตรีสำหรับเพลงนี้';

    return jsonOk({
      chords: chordsText,
      source: 'Gemini AI Search (dochords/buckchord/chordtab)'
    });

  } catch (error) {
    return jsonErr('เกิดข้อผิดพลาดในการค้นหาคอร์ดอัตโนมัติ: ' + error.message, 500);
  }
}
