const baseUrl = (import.meta.env.VITE_OLLAMA_BASE_URL || '/ollama').replace(/\/$/, '');
export const localModel = import.meta.env.VITE_OLLAMA_MODEL || 'qwen3.5:4b';

const tools = [
  {
    type: 'function',
    function: {
      name: 'navigate_to_page',
      description: 'Navigate to a visible application page. Use only when the user asks to open, show, or go to that page.',
      parameters: {
        type: 'object',
        properties: { page: { type: 'string', enum: ['Overview', 'Profile', 'Clients', 'Invoices', 'Payments'] } },
        required: ['page']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_workspace',
      description: 'Search the current workspace for a client, project, invoice, or other visible record.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', minLength: 1 } },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'start_guided_tour',
      description: 'Start an on-screen walkthrough when the user explicitly asks to be guided or shown how to create an invoice.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

const systemMessage = context => ({
  role: 'system',
  content: `You are Felps, a concise in-product copilot. You receive a fresh structured snapshot of the visible application page.
Use that context to answer questions and instruct the user with exact visible labels. Do not dump the full page context unless asked.
For greetings or casual conversation, reply naturally and briefly. Never call a tool unless the user is requesting an action.
When the user asks how to do something, explain the visible steps. Call start_guided_tour only when they explicitly request a walkthrough.
Never invent page content or claim an action completed before a tool result. Keep normal answers under 120 words.

LIVE PAGE CONTEXT:
${JSON.stringify(context)}`
});

export async function checkLocalAgent() {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) return false;
  const payload = await response.json();
  return payload.models?.some(item => item.name === localModel || item.model === localModel) || false;
}

export async function askLocalAgent({ question, context, history }) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: localModel,
      stream: false,
      think: false,
      options: { temperature: 0.2 },
      tools,
      messages: [
        systemMessage(context),
        ...history.slice(-8).filter(message => message.role !== 'tool').map(message => ({ role: message.role, content: message.text })),
        { role: 'user', content: question }
      ]
    })
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const payload = await response.json();
  return { content: payload.message?.content?.trim() || '', toolCalls: payload.message?.tool_calls || [] };
}

export function toolArguments(call) {
  const value = call?.function?.arguments ?? {};
  if (typeof value === 'object' && value !== null) return value;
  try { return JSON.parse(value); } catch { return {}; }
}
