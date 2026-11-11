const DEFAULTS = { endpoint: 'http://127.0.0.1:11434', model: 'qwen3.5:4b' };
const form = document.getElementById('settings');
const endpoint = document.getElementById('endpoint');
const model = document.getElementById('model');
const status = document.getElementById('status');

browser.storage.local.get(DEFAULTS).then(values => {
  endpoint.value = values.endpoint;
  model.value = values.model;
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  await browser.storage.local.set({ endpoint: endpoint.value.trim().replace(/\/+$/, ''), model: model.value.trim() });
  status.textContent = 'Configurações salvas.';
});

document.getElementById('test').addEventListener('click', async () => {
  status.textContent = 'Testando…';
  await browser.storage.local.set({ endpoint: endpoint.value.trim().replace(/\/+$/, ''), model: model.value.trim() });
  try {
    const result = await browser.runtime.sendMessage({ type: 'ALFRED_STATUS' });
    status.textContent = result.available ? `Conectado a ${result.model}.` : `Ollama conectado, mas o modelo ${result.model} não está instalado.`;
  } catch (error) {
    status.textContent = `Falha: ${error.message}`;
  }
});
