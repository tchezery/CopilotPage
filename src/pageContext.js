const isVisible = (element) => {
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
};

const clean = (value = '') => value.replace(/\s+/g, ' ').trim();

const accessibleName = (element) => {
  const labelledBy = element.getAttribute('aria-labelledby');
  const labelledText = labelledBy
    ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ')
    : '';
  const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : '';
  return clean(
    element.getAttribute('aria-label') ||
    labelledText ||
    label ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder') ||
    element.textContent ||
    element.getAttribute('name') ||
    element.tagName.toLowerCase()
  );
};

const unique = (items, limit) => [...new Set(items.filter(Boolean))].slice(0, limit);

export function readPageContext(pageName) {
  const roots = [...document.querySelectorAll('.sidebar, main')];
  const withinPage = (selector) => roots.flatMap(root => [...root.querySelectorAll(selector)]).filter(isVisible);

  const headings = unique(withinPage('h1, h2, h3, [role="heading"]').map(node => clean(node.textContent)), 24);
  const controls = unique(withinPage('button, a[href], input, textarea, select, [role="button"], [role="link"], [role="tab"]')
    .map((node, index) => {
      const tag = node.tagName.toLowerCase();
      const type = node.getAttribute('type');
      const role = node.getAttribute('role') || (tag === 'a' ? 'link' : tag);
      const value = ['input', 'textarea', 'select'].includes(tag) && type !== 'password' ? clean(node.value || '') : '';
      return `${index + 1}. ${role}: ${accessibleName(node)}${value ? ` (current value: ${value})` : ''}${node.disabled ? ' [disabled]' : ''}`;
    }), 60);

  const tables = withinPage('table').map((table) => {
    const rows = [...table.querySelectorAll('tr')].slice(0, 12).map(row =>
      [...row.querySelectorAll('th, td')].map(cell => clean(cell.textContent)).filter(Boolean).join(' | ')
    ).filter(Boolean);
    return rows.join('\n');
  }).filter(Boolean).slice(0, 4);

  const pageText = unique(withinPage('main p, main span, main label, main time')
    .map(node => clean(node.textContent))
    .filter(text => text.length > 2 && text.length < 280), 100)
    .join('\n')
    .slice(0, 6500);

  return {
    application: document.title,
    page: pageName,
    url: `${window.location.pathname}${window.location.search}`,
    headings,
    controls,
    tables,
    visibleText: pageText,
    capturedAt: new Date().toISOString()
  };
}

export function summarizeContext(context) {
  const headingText = context.headings.slice(0, 5).join(', ');
  const controlText = context.controls.slice(0, 8).map(item => item.replace(/^\d+\.\s*/, '')).join(', ');
  return `You are on the ${context.page} page. The visible sections are ${headingText || 'not clearly titled'}. Available controls include ${controlText || 'no identified controls'}. I can explain any visible section or guide you using these controls.`;
}

const stopWords = new Set(['a', 'an', 'and', 'are', 'can', 'do', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'page', 'please', 'the', 'this', 'to', 'what', 'where', 'with', 'you']);
const words = (value) => clean(value.toLowerCase()).replace(/[^a-z0-9$]+/g, ' ').split(' ').filter(word => word.length > 1 && !stopWords.has(word));
const controlLabel = (control) => control.replace(/^\d+\.\s*/, '').replace(/^[^:]+:\s*/, '').replace(/\s*\(current value:.*$/, '').replace(/\s*\[disabled\]$/, '');

export function answerFromPage(question, context) {
  const q = question.toLowerCase().trim().replace(/[!.?]+$/g, '');
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy)$/.test(q)) {
    return `Hi! I’m here if you want help with the ${context.page} page.`;
  }
  if (/^(ok|okay|thanks|thank you|cool|got it)$/.test(q)) {
    return 'You’re welcome. I’m here when you need me.';
  }
  if (q.includes("don't ask") || q.includes('dont ask') || q.includes('never mind') || q.includes('nevermind') || q.includes('no thanks') || q.includes('nothing')) {
    return 'No problem—I’ll stay out of the way until you need me.';
  }
  if (q.includes('what is this page') || q.includes('what page') || q.includes('where am i') || q.includes('explain this') || q.includes('describe this')) {
    return summarizeContext(context);
  }
  if (q.includes('what can i do') || q.includes('available actions') || q.includes('options') || q === 'help') {
    const actions = context.controls.slice(0, 10).map(controlLabel).filter(Boolean);
    return `On this page you can use: ${actions.join(', ')}.`;
  }

  const queryWords = words(q);
  const rankedControls = context.controls.map(control => ({
    control,
    score: queryWords.filter(word => control.toLowerCase().includes(word)).length
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

  if (/\b(how|where|which button|guide|instruct)\b/.test(q) && rankedControls.length) {
    const best = rankedControls[0].control;
    const type = best.replace(/^\d+\.\s*/, '').split(':')[0];
    return `Use the ${type} “${controlLabel(best)}” on the ${context.page} page. It is currently visible and available.`;
  }

  const contentLines = [
    ...context.headings,
    ...context.visibleText.split('\n'),
    ...context.tables.flatMap(table => table.split('\n'))
  ].filter(Boolean);
  const matches = contentLines.map(line => ({
    line,
    score: queryWords.filter(word => line.toLowerCase().includes(word)).length
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.line.length - b.line.length);

  if (matches.length) {
    const facts = [...new Set(matches.slice(0, 4).map(item => item.line))];
    return `I found this on the current page: ${facts.join(' · ')}`;
  }

  const sections = context.headings.slice(0, 5).join(', ');
  return `I can’t find that information on the visible ${context.page} page. The main visible sections are ${sections || 'not clearly labeled'}.`;
}
