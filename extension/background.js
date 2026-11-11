const DEFAULTS = {
  endpoint: 'http://127.0.0.1:11435',
  model: 'qwen3.5:4b'
};
const LEGACY_ENDPOINTS = new Set(['http://127.0.0.1:11434', 'http://localhost:11434']);

const cleanEndpoint = value => String(value || DEFAULTS.endpoint).trim().replace(/\/+$/, '');

async function settings() {
  const stored = await browser.storage.local.get(DEFAULTS);
  let endpoint = cleanEndpoint(stored.endpoint);
  if (LEGACY_ENDPOINTS.has(endpoint)) {
    endpoint = DEFAULTS.endpoint;
    await browser.storage.local.set({ endpoint });
  }
  return { endpoint, model: String(stored.model || DEFAULTS.model).trim() };
}

async function ollama(path, init = {}) {
  const config = await settings();
  const payload = await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(init.method || 'GET', `${config.endpoint}${path}`, true);
    request.responseType = 'text';
    request.timeout = 120000;
    Object.entries(init.headers || {}).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.onload = () => {
      let data = {};
      try { data = JSON.parse(request.responseText || '{}'); } catch { /* Ollama returned an invalid body. */ }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(data.error || `Ollama respondeu HTTP ${request.status}`));
        return;
      }
      resolve(data);
    };
    request.onerror = () => reject(new Error(`Não foi possível acessar ${config.endpoint}.`));
    request.ontimeout = () => reject(new Error('O Ollama demorou demais para responder.'));
    request.send(init.body || null);
  });
  return { payload, config };
}

browser.runtime.onMessage.addListener(async message => {
  try {
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
  } catch (error) {
    const detail = String(error?.message || error || 'Falha desconhecida.');
    console.warn('Felps: falha ao acessar o Ollama.', detail);
    return { ok: false, error: detail };
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
