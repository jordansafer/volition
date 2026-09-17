import OpenAI from 'openai';

const MAX_MESSAGES = 30;
const MAX_TEXT_CHARS = 24000;
const MAX_IMAGE_BYTES = 1024 * 1024;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return res.end(JSON.stringify(body));
}

function parseDataUrl(url) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url || '');
  if (!match) return null;
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return null;
  return { mimeType: match[1], data: match[2] };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!process.env.OPENAI_API_KEY) return json(res, 503, { error: 'OPENAI_API_KEY is not configured' });

  const payload = req.body || {};
  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) {
    return json(res, 400, { error: 'invalid message count' });
  }

  let totalTextChars = 0;
  const normalized = [];
  for (const message of messages) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)) {
      return json(res, 400, { error: 'invalid message' });
    }
    if (typeof message.content === 'string') {
      totalTextChars += message.content.length;
      normalized.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) return json(res, 400, { error: 'invalid message content' });
    const parts = [];
    for (const part of message.content) {
      if (part?.type === 'text' && typeof part.text === 'string') {
        totalTextChars += part.text.length;
        parts.push({ type: 'text', text: part.text });
      } else if (part?.type === 'image_url' && typeof part.image_url?.url === 'string') {
        const parsed = parseDataUrl(part.image_url.url);
        if (!parsed) return json(res, 400, { error: 'invalid or oversized image' });
        parts.push({ type: 'image_url', image_url: { url: part.image_url.url } });
      } else {
        return json(res, 400, { error: 'unsupported message part' });
      }
    }
    normalized.push({ role: message.role, content: parts });
  }

  if (totalTextChars > MAX_TEXT_CHARS) return json(res, 413, { error: 'request too large' });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: normalized,
      max_tokens: 350,
      temperature: 0.2
    });
    const reply = response.choices?.[0]?.message;
    if (!reply?.content) return json(res, 502, { error: 'no reply from model' });
    return json(res, 200, {
      reply: { role: 'assistant', content: reply.content },
      model: response.model || 'gpt-4o-mini',
      usage: response.usage || undefined
    });
  } catch (err) {
    console.error('Volition negotiation failed', err);
    return json(res, 503, { error: 'AI service temporarily unavailable' });
  }
}
