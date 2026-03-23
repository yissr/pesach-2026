export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const data = await request.json();
    const { name, email, message, type } = data;

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers });
    }

    const submission = {
      name: (name || '').trim(),
      email: (email || '').trim(),
      message: message.trim(),
      type: type || 'general', // general, price-correction, suggestion
      timestamp: new Date().toISOString(),
    };

    // Store in KV with timestamp key
    const key = `submission:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    await env.SUBMISSIONS.put(key, JSON.stringify(submission), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 days
    });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to process submission' }), { status: 500, headers });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
