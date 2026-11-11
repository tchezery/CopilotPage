import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const felpsModelUrl = browser.runtime.getURL('assets/Felps.glb');
let felpsSourcePromise;

function loadFelpsSource() {
  felpsSourcePromise ||= new GLTFLoader().loadAsync(felpsModelUrl);
  return felpsSourcePromise;
}

async function mountFelpsMascots(container) {
  const hosts = [...container.querySelectorAll('[data-felps-3d]')];
  if (!hosts.length) return;
  try {
    const gltf = await loadFelpsSource();
    for (const host of hosts) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(25, 1, 0.01, 100);
      camera.position.set(0, 0.04, 4.8);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.className = 'felps-mascot-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x51483f, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 3.8); key.position.set(-2.7, 3.5, 4.5); scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(3.4, 1.2, -2.4); scene.add(rim);
      const model = cloneSkeleton(gltf.scene);
      model.traverse(object => { if (object.isMesh) object.frustumCulled = false; });
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.scale.setScalar(1.72 / Math.max(size.x, size.y, size.z));
      const group = new THREE.Group(); group.add(model); group.position.y = 0.04; scene.add(group);
      const resize = () => {
        const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(host); resize();
      const phase = Math.random() * Math.PI * 2;
      const render = time => {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          group.position.y = 0.04 + Math.sin(time * 0.00125 + phase) * 0.035;
          group.rotation.y = Math.sin(time * 0.00048 + phase) * 0.06;
          group.rotation.z = Math.sin(time * 0.00072 + phase) * 0.018;
        }
        renderer.render(scene, camera); requestAnimationFrame(render);
      };
      requestAnimationFrame(render);
      host.dataset.ready = 'true';
    }
  } catch (error) {
    console.warn('Felps: não foi possível carregar o mascote 3D.', error);
  }
}

(() => {
  if (window.top !== window || document.getElementById('felps-extension-root')) return;

  const ROOT_ID = 'felps-extension-root';
  const HISTORY_KEY = `felps-history:${location.origin}`;
  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <button class="felps-launcher" type="button" aria-label="Abrir Felps">
      <span class="felps-mascot" data-felps-3d aria-label="Felps"><span class="felps-fallback">F</span><i></i></span>
      <span class="felps-launcher-copy"><small>PRECISA DE AJUDA?</small><b>Conversar com Felps</b></span>
      <svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1 4.1 1.4-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/></svg>
    </button>
    <section class="felps-panel" aria-label="Copiloto Felps" aria-hidden="true">
      <header>
        <span class="felps-mascot felps-mascot-small" data-felps-3d aria-label="Felps"><span class="felps-fallback">F</span><i></i></span>
        <div><small><i></i> COPILOTO LOCAL</small><h2>Felps</h2></div>
        <button class="felps-reset" type="button" title="Limpar conversa" aria-label="Limpar conversa">↻</button>
        <button class="felps-close" type="button" title="Fechar" aria-label="Fechar">×</button>
      </header>
      <div class="felps-context"><span></span><b>Conectando ao Ollama…</b></div>
      <div class="felps-messages" aria-live="polite"></div>
      <form class="felps-composer">
        <textarea rows="1" placeholder="Peça algo sobre esta página…" aria-label="Mensagem para Felps"></textarea>
        <div><small>As ações aparecem na tela</small><button type="submit" aria-label="Enviar">➤</button></div>
      </form>
    </section>
    <div class="felps-agent-cursor" aria-hidden="true">
      <svg viewBox="0 0 30 38"><path d="M3 2.5v27.2l7.2-6.6 5.2 11.6 5-2.3-5.1-11.1 9.5-.8L3 2.5Z"/></svg>
      <span>FELPS</span><i></i>
    </div>`;
  document.documentElement.appendChild(root);
  mountFelpsMascots(root);

  const launcher = root.querySelector('.felps-launcher');
  const panel = root.querySelector('.felps-panel');
  const closeButton = root.querySelector('.felps-close');
  const resetButton = root.querySelector('.felps-reset');
  const messagesNode = root.querySelector('.felps-messages');
  const composer = root.querySelector('.felps-composer');
  const input = composer.querySelector('textarea');
  const send = composer.querySelector('button');
  const contextLabel = root.querySelector('.felps-context b');
  const contextDot = root.querySelector('.felps-context span');
  const cursor = root.querySelector('.felps-agent-cursor');
  let history = [];
  let busy = false;
  let elementsByRef = new Map();

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isVisible = element => {
    if (!(element instanceof Element) || root.contains(element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
  };
  const labelOf = element => {
    const labelledBy = element.getAttribute('aria-labelledby');
    const labelledText = labelledBy ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ') : '';
    const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : '';
    return clean(element.getAttribute('aria-label') || labelledText || label || element.getAttribute('title') || element.getAttribute('placeholder') || element.innerText || element.getAttribute('name') || element.tagName.toLowerCase());
  };

  function readPageContext() {
    elementsByRef = new Map();
    const controls = [...document.querySelectorAll('button,a[href],input:not([type="hidden"]),textarea,select,[role="button"],[role="link"],[role="tab"],[contenteditable="true"]')]
      .filter(isVisible)
      .slice(0, 90)
      .map((element, index) => {
        const ref = `control-${index + 1}`;
        elementsByRef.set(ref, element);
        const tag = element.tagName.toLowerCase();
        const type = element.getAttribute('type') || (element.isContentEditable ? 'contenteditable' : tag);
        const value = ['input', 'textarea', 'select'].includes(tag) && !['password', 'file'].includes(type) ? clean(element.value).slice(0, 160) : '';
        return { ref, tag, type, label: labelOf(element).slice(0, 180), value, disabled: Boolean(element.disabled), href: tag === 'a' ? element.href.slice(0, 240) : '' };
      });
    const uniqueText = selector => [...new Set([...document.querySelectorAll(selector)].filter(isVisible).map(node => clean(node.textContent)).filter(Boolean))];
    const headings = uniqueText('h1,h2,h3,[role="heading"]').slice(0, 30);
    const tables = [...document.querySelectorAll('table')].filter(isVisible).slice(0, 6).map(table =>
      [...table.querySelectorAll('tr')].filter(isVisible).slice(0, 14).map(row =>
        [...row.querySelectorAll('th,td')].map(cell => clean(cell.textContent)).filter(Boolean).join(' | ')
      ).filter(Boolean)
    );
    const visibleText = uniqueText('main p,main li,article p,article li,[role="main"] p,[role="main"] li')
      .filter(text => text.length > 2 && text.length < 500).slice(0, 100).join('\n').slice(0, 9000);
    return { title: document.title, url: location.href, language: document.documentElement.lang || navigator.language, headings, controls, tables, visibleText, scroll: { y: Math.round(scrollY), viewportHeight: innerHeight, documentHeight: document.documentElement.scrollHeight } };
  }

  function toolDefinitions(context) {
    const refs = context.controls.map(item => item.ref);
    const pointableRefs = refs.length ? refs : ['none'];
    return [
      { type: 'function', function: { name: 'point_to_element', description: 'Move o cursor visual até um controle visível, sem ativá-lo.', parameters: { type: 'object', properties: { elementRef: { type: 'string', enum: pointableRefs } }, required: ['elementRef'] } } },
      { type: 'function', function: { name: 'click_element', description: 'Clica um controle visível. Não use para excluir, comprar, pagar, enviar formulário, aceitar termos ou outras ações irreversíveis.', parameters: { type: 'object', properties: { elementRef: { type: 'string', enum: pointableRefs } }, required: ['elementRef'] } } },
      { type: 'function', function: { name: 'fill_field', description: 'Preenche um campo de texto visível. Senhas e arquivos nunca são permitidos.', parameters: { type: 'object', properties: { elementRef: { type: 'string', enum: pointableRefs }, text: { type: 'string', maxLength: 2000 } }, required: ['elementRef', 'text'] } } },
      { type: 'function', function: { name: 'scroll_to_element', description: 'Rola a página e mostra um controle visível.', parameters: { type: 'object', properties: { elementRef: { type: 'string', enum: pointableRefs } }, required: ['elementRef'] } } },
      { type: 'function', function: { name: 'scroll_page', description: 'Rola a página uma tela para cima ou para baixo.', parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] } } },
      { type: 'function', function: { name: 'go_back', description: 'Volta para a página anterior somente quando o usuário pedir.', parameters: { type: 'object', properties: {} } } }
    ];
  }

  function systemMessage(context) {
    return { role: 'system', content: `Você é Felps, um copiloto local dentro do Firefox. Responda no idioma do usuário de forma objetiva e útil.
Você recebeu um retrato da aba atual. Use somente informações desse retrato; não invente conteúdo nem diga que realizou uma ação antes do resultado da tool.
Você pode explicar a página, apontar controles e executar ações simples quando o usuário pedir. Nunca clique ou preencha algo por iniciativa própria.
Não execute exclusão, compra, pagamento, consentimento, publicação, envio final de formulário, alteração de senha ou ação irreversível. Nesses casos, explique e apenas aponte o controle para o usuário decidir.
Não solicite nem manipule senhas, dados bancários ou segredos. Prefira point_to_element quando a intenção for apenas mostrar onde fazer algo.
Se um controle não estiver no contexto, diga que ele não está visível. Mantenha respostas normais abaixo de 160 palavras.

CONTEXTO DA ABA:
${JSON.stringify(context)}` };
  }

  const dangerous = /\b(delete|remove|erase|destroy|purchase|buy|pay|checkout|submit|publish|confirm|accept terms|unsubscribe|excluir|apagar|remover|comprar|pagar|finalizar|enviar|publicar|confirmar|aceitar termos|cancelar assinatura)\b/i;

  async function animateCursor(target, click = false) {
    if (!isVisible(target)) throw new Error('O controle não está mais visível.');
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    await wait(280);
    const rect = target.getBoundingClientRect();
    cursor.className = 'felps-agent-cursor visible';
    cursor.style.transform = `translate3d(${innerWidth - 64}px,${innerHeight - 80}px,0)`;
    target.classList.add('felps-extension-target');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    cursor.classList.add('moving');
    cursor.style.transform = `translate3d(${rect.left + rect.width / 2}px,${rect.top + rect.height / 2}px,0)`;
    await wait(720);
    cursor.classList.remove('moving');
    if (click) { cursor.classList.add('clicking'); await wait(300); cursor.classList.remove('clicking'); }
    target.classList.remove('felps-extension-target');
    await wait(click ? 160 : 420);
    cursor.classList.remove('visible');
  }

  function elementFor(ref) {
    const element = elementsByRef.get(ref);
    if (!element || !isVisible(element)) throw new Error('O controle solicitado não está mais visível.');
    return element;
  }

  async function executeTool(call) {
    const name = call?.function?.name;
    let args = call?.function?.arguments || {};
    if (typeof args === 'string') args = JSON.parse(args || '{}');
    if (name === 'scroll_page') { const distance = Math.max(320, innerHeight * 0.78) * (args.direction === 'up' ? -1 : 1); scrollBy({ top: distance, behavior: 'smooth' }); await wait(650); return `A página foi rolada para ${args.direction === 'up' ? 'cima' : 'baixo'}.`; }
    if (name === 'go_back') { window.history.back(); return 'Voltando para a página anterior.'; }
    const target = elementFor(args.elementRef);
    const label = labelOf(target) || args.elementRef;
    if (name === 'point_to_element' || name === 'scroll_to_element') { await animateCursor(target, false); return `Mostrei o controle “${label}”.`; }
    if (name === 'click_element') {
      if (target.disabled || target.getAttribute('aria-disabled') === 'true') throw new Error('O controle está desabilitado.');
      if (dangerous.test(label)) throw new Error(`A ação “${label}” é sensível. Aponte o controle e deixe a confirmação para o usuário.`);
      await animateCursor(target, true); target.click(); return `Cliquei em “${label}”.`;
    }
    if (name === 'fill_field') {
      const type = String(target.getAttribute('type') || '').toLowerCase();
      if (['password', 'file', 'hidden'].includes(type)) throw new Error('Esse tipo de campo não pode ser preenchido pelo Felps.');
      await animateCursor(target, true); target.focus();
      const text = String(args.text ?? '').slice(0, 2000);
      if (target.isContentEditable) target.textContent = text;
      else {
        const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter ? setter.call(target, text) : (target.value = text);
      }
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return `Preenchi “${label}”.`;
    }
    throw new Error('Tool não permitida.');
  }

  function appendMessage(role, text) {
    const node = document.createElement('div'); node.className = `felps-message ${role}`;
    const content = document.createElement('div');
    clean(text).split(/\n{2,}/).forEach(paragraph => { const p = document.createElement('p'); p.textContent = paragraph; content.appendChild(p); });
    node.appendChild(content); messagesNode.appendChild(node); messagesNode.scrollTop = messagesNode.scrollHeight; return node;
  }

  function appendTool(name, done = false) {
    root.querySelector('.felps-tool.running')?.remove();
    const node = document.createElement('div'); node.className = `felps-tool ${done ? 'done' : 'running'}`;
    const icon = document.createElement('i'); icon.textContent = done ? '✓' : '…';
    const copy = document.createElement('span'); const title = document.createElement('b'); title.textContent = name;
    const status = document.createElement('small'); status.textContent = done ? 'Concluído' : 'Felps está usando esta ferramenta…';
    copy.append(title, status); node.append(icon, copy); messagesNode.appendChild(node); messagesNode.scrollTop = messagesNode.scrollHeight;
  }

  function showThinking(show) {
    root.querySelector('.felps-thinking')?.remove(); if (!show) return;
    const node = document.createElement('div'); node.className = 'felps-thinking'; node.innerHTML = '<i></i><i></i><i></i>';
    messagesNode.appendChild(node); messagesNode.scrollTop = messagesNode.scrollHeight;
  }

  async function saveHistory() { await browser.storage.local.set({ [HISTORY_KEY]: history.slice(-24) }); }
  function renderHistory() {
    messagesNode.replaceChildren();
    if (!history.length) {
      appendMessage('assistant', 'Olá! Sou o Felps. Posso ler esta página, explicar o que está visível e usar controles por você.');
      const suggestions = document.createElement('div'); suggestions.className = 'felps-suggestions';
      ['O que tem nesta página?', 'Quais ações posso fazer?', 'Mostre o principal botão desta tela'].forEach(text => { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click', () => run(text)); suggestions.appendChild(button); });
      messagesNode.appendChild(suggestions);
    } else history.forEach(item => appendMessage(item.role, item.content));
  }

  async function run(raw) {
    const question = clean(raw); if (!question || busy) return;
    busy = true; input.value = ''; input.disabled = true; send.disabled = true;
    history.push({ role: 'user', content: question }); appendMessage('user', question); showThinking(true); await saveHistory();
    const context = readPageContext(); const tools = toolDefinitions(context); const messages = [systemMessage(context), ...history.slice(-10)];
    try {
      let finalText = '';
      for (let step = 0; step < 4; step += 1) {
        const result = await browser.runtime.sendMessage({ type: 'FELPS_CHAT', messages, tools });
        const message = result?.message || {}; const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
        contextLabel.textContent = `${result.model} · página ativa`; contextDot.classList.add('online');
        if (!calls.length) { finalText = clean(message.content) || 'Não consegui formular uma resposta.'; break; }
        messages.push({ role: 'assistant', content: message.content || '', tool_calls: calls }); showThinking(false);
        for (const call of calls.slice(0, 2)) {
          const name = call.function?.name || 'tool'; appendTool(name, false); let toolResult;
          try { toolResult = await executeTool(call); } catch (error) { toolResult = `Erro: ${error.message}`; }
          appendTool(name, true); messages.push({ role: 'tool', content: toolResult });
        }
        showThinking(true);
      }
      showThinking(false); if (!finalText) finalText = 'Concluí as ações disponíveis nesta página.';
      history.push({ role: 'assistant', content: finalText }); appendMessage('assistant', finalText); await saveHistory();
    } catch (error) {
      showThinking(false); contextDot.classList.remove('online'); contextLabel.textContent = 'Ollama indisponível';
      const detail = clean(error?.message || error); const text = `Não consegui acessar o Ollama local. ${detail ? `Detalhe: ${detail}` : 'Confira se o serviço está rodando.'}`;
      history.push({ role: 'assistant', content: text }); appendMessage('assistant', text); await saveHistory();
    } finally { busy = false; input.disabled = false; send.disabled = false; input.focus(); }
  }

  function openPanel() { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); launcher.classList.add('hidden'); setTimeout(() => input.focus(), 180); }
  function closePanel() { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); launcher.classList.remove('hidden'); }
  function togglePanel() { panel.classList.contains('open') ? closePanel() : openPanel(); }
  launcher.addEventListener('click', openPanel); closeButton.addEventListener('click', closePanel);
  resetButton.addEventListener('click', async () => { history = []; await browser.storage.local.remove(HISTORY_KEY); renderHistory(); input.focus(); });
  composer.addEventListener('submit', event => { event.preventDefault(); run(input.value); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); run(input.value); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && panel.classList.contains('open')) closePanel(); });
  browser.runtime.onMessage.addListener(message => { if (message?.type === 'FELPS_TOGGLE') togglePanel(); });
  browser.storage.local.get(HISTORY_KEY).then(stored => { history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : []; renderHistory(); });
  browser.runtime.sendMessage({ type: 'FELPS_STATUS' }).then(result => { contextLabel.textContent = result.available ? `${result.model} · pronto` : `${result.model} · não instalado`; contextDot.classList.toggle('online', result.available); }).catch(() => { contextLabel.textContent = 'Ollama indisponível'; });
})();
