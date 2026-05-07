// Vercel serverless function — proxies Groq API calls server-side.
// This bypasses corporate firewalls that block direct browser→api.groq.com requests.
// The browser calls /api/groq on the Vercel domain; this function calls Groq from the server.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const { prompt, apiKey } = req.body || {};

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 20) {
    return res.status(400).json({ error: { message: 'Missing or invalid API key' } });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: { message: 'Missing prompt' } });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    // Forward non-200 errors back to the browser with the Groq error body
    if (!groqRes.ok) {
      let errBody;
      try { errBody = await groqRes.json(); }
      catch (_) { errBody = { error: { message: `Groq returned HTTP ${groqRes.status}` } }; }
      return res.status(groqRes.status).json(errBody);
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    return res.status(200).json({ content });

  } catch (err) {
    // Network error reaching Groq from the server side
    return res.status(502).json({ error: { message: `Proxy error: ${err.message}` } });
  }
}
