// api/generate.js  —  Vercel 서버리스 함수
// 브라우저가 여기로 요청하고, 키는 서버에만 남습니다.
// Vercel → Settings → Environment Variables 에 ANTHROPIC_API_KEY 등록 후 Redeploy.

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 허용됩니다.' });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 없습니다.' });
  }

  try {
    const { prompt } = req.body || {};   // json 플래그는 클라이언트 호환용으로 받기만 한다
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt가 비어 있습니다.' });
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,          // 한국어는 토큰을 많이 먹어 넉넉히 잡습니다
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({ error: 'Anthropic API 오류', detail: detail.slice(0, 500) });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return res.status(200).json({ text, stop: data.stop_reason });
  } catch (err) {
    return res.status(500).json({ error: '서버 오류', detail: String(err && err.message) });
  }
};
