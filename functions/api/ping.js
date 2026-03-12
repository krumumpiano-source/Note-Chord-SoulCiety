export async function onRequestGet() {
  return Response.json({ success: true, data: { message: 'pong', time: new Date().toISOString() } });
}
