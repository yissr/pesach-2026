export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Auth via Authorization header or query param
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || (request.headers.get('Authorization') || '').replace('Bearer ', '');

  if (!key || key !== (env.ADMIN_KEY || 'pesach2026admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  try {
    const list = await env.SUBMISSIONS.list({ prefix: 'submission:' });

    // Parallel KV reads
    const values = await Promise.all(
      list.keys.map(item => env.SUBMISSIONS.get(item.name))
    );
    const submissions = values.filter(Boolean).map(v => JSON.parse(v));

    // Sort newest first
    submissions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return new Response(JSON.stringify({ count: submissions.length, submissions }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch submissions' }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
