export async function onRequestGet(context) {
  const { request, env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  // Simple password check via query param
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key || key !== (env.ADMIN_KEY || 'pesach2026admin')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }

  try {
    const list = await env.SUBMISSIONS.list({ prefix: 'submission:' });
    const submissions = [];

    for (const item of list.keys) {
      const val = await env.SUBMISSIONS.get(item.name);
      if (val) {
        submissions.push(JSON.parse(val));
      }
    }

    // Sort newest first
    submissions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return new Response(JSON.stringify({ count: submissions.length, submissions }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch submissions' }), { status: 500, headers });
  }
}
