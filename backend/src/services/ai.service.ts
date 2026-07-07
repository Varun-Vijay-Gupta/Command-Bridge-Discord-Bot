import { env } from '../config/env';
import { logger } from '../config/logger';

interface AiResult {
  summary: string;
  tags: string[];
}

export async function summarizeInteraction(
  commandName: string,
  options: Record<string, unknown>,
  userName: string
): Promise<AiResult | null> {
  if (env.AI_PROVIDER === 'none') {
    return null;
  }

  const prompt = `Analyze this Discord slash command interaction and provide a brief summary (1-2 sentences) and 2-4 relevant tags.

Command: /${commandName}
User: ${userName}
Options: ${JSON.stringify(options)}

Respond in JSON format only: {"summary": "...", "tags": ["tag1", "tag2"]}`;

  try {
    if (env.AI_PROVIDER === 'groq' && env.GROQ_API_KEY) {
      return await callGroq(prompt);
    }
    if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      return await callGemini(prompt);
    }
  } catch (error) {
    logger.warn('AI summarization failed', { error });
  }

  return null;
}

async function callGroq(prompt: string): Promise<AiResult> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices[0]?.message?.content || '{}';
  return parseAiResponse(content);
}

async function callGemini(prompt: string): Promise<AiResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  const content = data.candidates[0]?.content?.parts[0]?.text || '{}';
  return parseAiResponse(content);
}

function parseAiResponse(content: string): AiResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { summary: content.slice(0, 200), tags: ['unparsed'] };
  }
  const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; tags?: string[] };
  return {
    summary: parsed.summary || 'No summary',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}
