const DEFAULTS = {
  endpoint: 'http://127.0.0.1:11434',
  model: 'qwen3.5:4b'
};

const cleanEndpoint = value => String(value || DEFAULTS.endpoint).trim().replace(/\/+$/, '');

async function settings() {
  const stored = await browser.storage.local.get(DEFAULTS);
  return { endpoint: cleanEndpoint(stored.endpoint), model: String(stored.model || DEFAULTS.model).trim() };
}

async function ollama(path, init) {
  const config = await settings();
  const response = await fetch(`${config.endpoint}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Ollama respondeu HTTP ${response.status}`);
  return { payload, config };
}

browser.runtime.onMessage.addListener(async message => {
  if (message?.type === 'FELPS_STATUS') {
    const { payload, config } = await ollama('/api/tags');
    const available = Array.isArray(payload.models) && payload.models.some(item => item.name === config.model || item.model === config.model);
    return { ok: true, available, ...config };
  }

  if (message?.type === 'FELPS_CHAT') {
    const config = await settings();
    const { payload } = await ollama('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        think: false,
        options: { temperature: 0.2 },
        messages: message.messages,
        tools: message.tools
      })
    });
    return { ok: true, message: payload.message, model: config.model };
  }
});

browser.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    await browser.tabs.sendMessage(tab.id, { type: 'FELPS_TOGGLE' });
  } catch {
    // Firefox internal pages intentionally do not allow content scripts.
  }
});
