// Chord search — find a chord/lyrics page for a song via Google search link

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q');
  if (!q || q.trim().length === 0) {
    return Response.json({ success: false, error: 'Missing query' }, { status: 400 });
  }

  const songName = q.trim();

  try {
    // Return Google search URL — let the user search and choose themselves
    const googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(songName + ' คอร์ด');

    return Response.json({
      success: true,
      data: {
        url: googleUrl,
        source: 'google',
        searchLinks: {
          chordTH: googleUrl,
          chordEN: 'https://www.google.com/search?q=' + encodeURIComponent(songName + ' chord'),
          lyrics: 'https://www.google.com/search?q=' + encodeURIComponent(songName + ' เนื้อเพลง คอร์ด')
        }
      }
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
