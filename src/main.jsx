import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import alfredUrl from '../Alfred.glb?url';
import { answerFromPage, readPageContext } from './pageContext.js';
import { askLocalAgent, checkLocalAgent, localModel, toolArguments } from './localAgent.js';
import './styles.css';
import './cursor.css';

const Icon = ({ name, size = 18 }) => {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.36.25.6.61.6 1v.4h1v4h-.1A1.7 1.7 0 0 0 19.4 15z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    send: <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    mouse: <><rect x="7" y="2" width="10" height="20" rx="5"/><path d="M12 6v4"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

function Alfred3D({ compact = false }) {
  const mount = useRef(null);
  useEffect(() => {
    if (!mount.current) return;
    const host = mount.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, .1, 100);
    camera.position.set(0, .05, 6);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x756658, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(2, 3, 4); scene.add(key);
    let model;
    new GLTFLoader().load(alfredUrl, (gltf) => {
      model = gltf.scene;
      model.scale.setScalar(compact ? 1.95 : 1.55);
      model.position.y = compact ? -.05 : -.14;
      model.rotation.y = -.15;
      scene.add(model);
    });
    let frame;
    const start = performance.now();
    const animate = () => {
      const t = (performance.now() - start) / 1000;
      if (model) { model.position.y += (Math.sin(t * 1.6) * .018 - (model.position.y - (compact ? -.05 : -.14))) * .04; model.rotation.y = -.15 + Math.sin(t * .55) * .12; }
      renderer.render(scene, camera); frame = requestAnimationFrame(animate);
    };
    animate();
    const resize = () => { if (!host.clientWidth) return; renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); renderer.dispose(); host.replaceChildren(); };
  }, [compact]);
  return <div className="alfred-3d" ref={mount} aria-label="Alfred assistant character" />;
}

function AgentCursor({ state }) {
  return <div
    className={`agent-cursor ${state.visible ? 'visible' : ''} ${state.moving ? 'moving' : ''} ${state.pressed ? 'pressed' : ''}`}
    style={{ transform: `translate3d(${state.x}px, ${state.y}px, 0)` }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 30 38" role="presentation"><path d="M3 2.5v27.2l7.2-6.6 5.2 11.6 5-2.3-5.1-11.1 9.5-.8L3 2.5Z"/></svg>
    <span className="agent-cursor-label">ALFRED</span>
    <i className="agent-cursor-ring" />
  </div>;
}

const recent = [
  ['Luma Studio', 'Design partner', '$12,480', 'Paid', 'Oct 28'],
  ['Kanso Labs', 'Engineering', '$8,750', 'Pending', 'Oct 27'],
  ['North & Co.', 'Research sprint', '$6,200', 'Paid', 'Oct 24'],
  ['Atelier Nine', 'Brand system', '$4,900', 'Overdue', 'Oct 19']
];

const toolCatalog = {
  navigate_to_page: { label: 'navigate_to_page', detail: 'Opens a page in the application' },
  search_workspace: { label: 'search_workspace', detail: 'Searches projects, clients, and invoices' },
  start_guided_tour: { label: 'start_guided_tour', detail: 'Highlights controls step by step' }
};

function Copilot({ currentPage, onNavigate, onSearch, onGuide }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelStatus, setModelStatus] = useState('checking');
  const [messages, setMessages] = useState([{ role: 'assistant', text: "Hi, I’m Alfred. I know this workspace and can use tools to help you get things done." }]);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy]);
  useEffect(() => { checkLocalAgent().then(ready => setModelStatus(ready ? 'online' : 'offline')).catch(() => setModelStatus('offline')); }, []);

  const executeTool = async (call) => {
    const name = call?.function?.name;
    const args = toolArguments(call);
    if (name === 'navigate_to_page' && ['Overview', 'Profile', 'Clients', 'Invoices', 'Payments'].includes(args.page)) {
      await onNavigate(args.page);
      return `Opened the ${args.page} page.`;
    }
    if (name === 'search_workspace' && typeof args.query === 'string' && args.query.trim()) {
      await onSearch(args.query.trim());
      return `Searched the workspace for “${args.query.trim()}”.`;
    }
    if (name === 'start_guided_tour') {
      await onGuide();
      return 'Started the guided invoice walkthrough.';
    }
    throw new Error('Unsupported or invalid tool action.');
  };

  const run = async (raw) => {
    const query = raw.trim(); if (!query || busy) return;
    setInput(''); setMessages(m => [...m, { role: 'user', text: query }]); setBusy(true);
    const context = readPageContext(currentPage);
    try {
      const result = await askLocalAgent({ question: query, context, history: messages });
      setModelStatus('online');
      const call = result.toolCalls[0];
      if (!call) {
        setMessages(m => [...m, { role: 'assistant', text: result.content || answerFromPage(query, context) }]);
        return;
      }
      const tool = toolCatalog[call.function?.name];
      if (!tool) throw new Error('Unsupported tool');
      setMessages(m => [...m, { role: 'tool', tool, status: 'Running' }]);
      const completion = await executeTool(call);
      setMessages(m => [...m.slice(0, -1), { role: 'tool', tool, status: 'Done' }, { role: 'assistant', text: result.content || completion }]);
    } catch {
      setModelStatus('offline');
      setMessages(m => [...m, { role: 'assistant', text: `${answerFromPage(query, context)} (Local model unavailable.)` }]);
    } finally {
      setBusy(false);
    }
  };

  return <>
    {open && <section className="copilot-panel" aria-label="Alfred copilot">
      <header className="copilot-head">
        <div className="head-avatar"><Alfred3D compact /></div>
        <div><div className="eyebrow"><span className="online"/> YOUR COPILOT</div><h2>Ask Alfred</h2></div>
        <button className="icon-button close" onClick={() => setOpen(false)} aria-label="Close copilot"><Icon name="close" /></button>
      </header>
      <div className="copilot-body">
        <div className={`context-pill model-${modelStatus}`}><Icon name="spark" size={14}/> {modelStatus === 'online' ? `${localModel} · Live page` : modelStatus === 'offline' ? 'Local model offline · Page fallback' : 'Connecting to local model…'}</div>
        {messages.map((message, i) => message.role === 'tool' ?
          <div className="tool-call" key={i}><div className="tool-icon">{message.status === 'Done' ? <Icon name="check" size={15}/> : <span className="spinner"/>}</div><div><b>{message.tool.label}</b><span>{message.status === 'Done' ? message.tool.detail : 'Alfred is using this tool…'}</span></div><em>{message.status}</em></div>
          : <div className={`message ${message.role}`} key={i}>{message.text}</div>)}
        {busy && messages.at(-1)?.role !== 'tool' && <div className="thinking"><i/><i/><i/></div>}
        {messages.length === 1 && <div className="suggestions">
          <button onClick={() => run('Open my profile')}><Icon name="users" size={15}/> Open my profile <Icon name="chevron" size={14}/></button>
          <button onClick={() => run('Search for the Kanso invoice')}><Icon name="search" size={15}/> Find an invoice <Icon name="chevron" size={14}/></button>
          <button onClick={() => run('How do I create an invoice?')}><Icon name="mouse" size={15}/> Guide me <Icon name="chevron" size={14}/></button>
        </div>}
        <div ref={end}/>
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); run(input); }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(input); }}} placeholder="Ask about this page or take an action…" rows="1" />
        <div><span>Alfred can make mistakes</span><button type="submit" aria-label="Send message" disabled={!input.trim() || busy}><Icon name="send" size={17}/></button></div>
      </form>
    </section>}
    {!open && <button className="copilot-launcher" onClick={() => setOpen(true)} aria-label="Open Alfred copilot">
      <span className="launcher-model"><Alfred3D compact /></span>
      <span><small>NEED A HAND?</small><b>Ask Alfred</b></span><Icon name="spark" size={18}/>
    </button>}
  </>;
}

function App() {
  const [page, setPage] = useState('Overview');
  const [search, setSearch] = useState('');
  const [tour, setTour] = useState(false);
  const [cursor, setCursor] = useState({ visible: false, moving: false, pressed: false, x: window.innerWidth - 54, y: window.innerHeight - 66 });

  useEffect(() => {
    const showUserClick = (event) => {
      if (!event.isTrusted) return;
      const ripple = document.createElement('span');
      ripple.className = 'user-click-ripple';
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 560);
    };
    window.addEventListener('pointerdown', showUserClick, true);
    return () => window.removeEventListener('pointerdown', showUserClick, true);
  }, []);

  const animateAgentClick = (selector, action) => new Promise((resolve) => {
    const target = document.querySelector(selector);
    if (!target) { action(); resolve(); return; }
    const rect = target.getBoundingClientRect();
    const destination = { x: rect.left + rect.width * .52, y: rect.top + rect.height * .54 };
    const origin = { x: Math.min(window.innerWidth - 44, window.innerWidth > 650 ? window.innerWidth - 205 : window.innerWidth - 45), y: window.innerHeight - 75 };
    setCursor({ visible: true, moving: false, pressed: false, ...origin });
    target.classList.add('agent-target');
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setCursor({ visible: true, moving: true, pressed: false, ...destination })));
    window.setTimeout(() => {
      setCursor({ visible: true, moving: false, pressed: true, ...destination });
      target.classList.add('agent-target-clicked');
      window.setTimeout(() => {
        action();
        setCursor({ visible: true, moving: false, pressed: false, ...destination });
        target.classList.remove('agent-target', 'agent-target-clicked');
        window.setTimeout(() => { setCursor(current => ({ ...current, visible: false })); resolve(); }, 330);
      }, 180);
    }, 720);
  });

  const navigate = (next) => animateAgentClick(next === 'Overview' && page === 'Profile' ? '.back' : `[data-agent-page="${next}"]`, () => setPage(next));
  const runSearch = (term) => animateAgentClick('.searchbox', () => setSearch(term));
  const startGuide = () => animateAgentClick('.new-invoice-button', () => setTour(true));
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span>N</span><b>NORTHSTAR</b></div>
      <nav aria-label="Main navigation">
        <p>WORKSPACE</p>
        {[["Overview","grid"],["Clients","users"],["Invoices","file"],["Payments","card"]].map(([label, icon]) => <button key={label} data-agent-page={label} className={page === label ? 'active' : ''} onClick={() => setPage(label)}><Icon name={icon}/><span>{label}</span>{label === 'Invoices' && <em>8</em>}</button>)}
        <p>MANAGE</p>
        <button><Icon name="file"/><span>Documents</span></button><button><Icon name="users"/><span>Team</span></button>
      </nav>
      <div className="sidebar-bottom"><button><Icon name="settings"/><span>Settings</span></button><div className="help-card"><span>?</span><b>Need support?</b><p>Visit our help center</p><a href="#help">Get help <Icon name="arrow" size={13}/></a></div></div>
    </aside>
    <main>
      <header className="topbar">
        <div className="searchbox"><Icon name="search"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workspace…"/><kbd>⌘ K</kbd></div>
        <button className="icon-button"><Icon name="bell"/></button>
        <button className="profile-button" data-agent-page="Profile" onClick={() => setPage('Profile')}><span>TC</span><div><b>Tom Chezery</b><small>Administrator</small></div><span className="down">⌄</span></button>
      </header>
      {page === 'Profile' ? <Profile onBack={() => setPage('Overview')}/> : <Dashboard search={search}/>} 
    </main>
    {tour && <Tour onClose={() => setTour(false)}/>} 
    <AgentCursor state={cursor}/>
    <Copilot currentPage={page} onNavigate={navigate} onSearch={runSearch} onGuide={startGuide}/>
  </div>;
}

function Dashboard({ search }) {
  const rows = search ? recent.filter(r => r.join(' ').toLowerCase().includes(search.toLowerCase())) : recent;
  return <div className="content">
    <div className="page-title"><div><p>FRIDAY, NOVEMBER 7</p><h1>Good evening, Tom.</h1><span>Here’s what’s happening with your business today.</span></div><button className="new-invoice-button"><Icon name="plus"/> New invoice</button></div>
    <section className="metrics">
      <article><div><span>Revenue</span><em className="up">+12.4%</em></div><h3>$48,290</h3><p>vs. $42,972 last month</p><div className="mini-chart"><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
      <article><div><span>Outstanding</span><em>6 invoices</em></div><h3>$14,850</h3><p>Across 4 clients</p><div className="progress"><i style={{width:'64%'}}/></div></article>
      <article><div><span>Active clients</span><em className="up">+3 this month</em></div><h3>24</h3><p>18 recurring clients</p><div className="avatars"><i>LS</i><i>KL</i><i>NC</i><i>+21</i></div></article>
    </section>
    <section className="workspace-grid">
      <article className="revenue-panel"><div className="section-head"><div><p>REVENUE OVERVIEW</p><h2>$162,540 <em>YTD</em></h2></div><select defaultValue="6"><option value="6">Last 6 months</option><option value="12">Last year</option></select></div><div className="chart"><span className="y y1">50k</span><span className="y y2">25k</span><span className="y y3">0</span><svg viewBox="0 0 700 190" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ea6b2d" stopOpacity=".22"/><stop offset="1" stopColor="#ea6b2d" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 154 C62 140 80 120 135 126 S215 91 280 105 S365 38 420 71 S500 74 558 43 S635 43 700 18 L700 190 L0 190 Z"/><path className="line" d="M0 154 C62 140 80 120 135 126 S215 91 280 105 S365 38 420 71 S500 74 558 43 S635 43 700 18"/></svg><div className="months"><span>JUN</span><span>JUL</span><span>AUG</span><span>SEP</span><span>OCT</span><span>NOV</span></div></div></article>
      <article className="activity-panel"><div className="section-head"><div><p>RECENT ACTIVITY</p><h2>Workspace feed</h2></div><button>View all</button></div>{[['✓','Invoice paid','Luma Studio paid $12,480','12 min'],['+','New client added','Maya added Kanso Labs','2 hr'],['↗','Proposal viewed','North & Co. opened your proposal','5 hr'],['!','Payment overdue','Atelier Nine · 4 days overdue','1 day']].map((x,i)=><div className="activity" key={x[1]}><i className={`a${i}`}>{x[0]}</i><div><b>{x[1]}</b><span>{x[2]}</span></div><time>{x[3]}</time></div>)}</article>
    </section>
    <section className="transactions"><div className="section-head"><div><p>RECENT INVOICES</p><h2>Latest transactions</h2></div><button>View all invoices <Icon name="arrow" size={15}/></button></div><table><thead><tr><th>CLIENT</th><th>PROJECT</th><th>AMOUNT</th><th>STATUS</th><th>ISSUED</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}><td><span className="client-mark">{r[0].split(' ').map(w=>w[0]).join('').slice(0,2)}</span><b>{r[0]}</b></td><td>{r[1]}</td><td><b>{r[2]}</b></td><td><span className={`status ${r[3].toLowerCase()}`}>{r[3]}</span></td><td>{r[4]}</td><td>•••</td></tr>)}</tbody></table>{!rows.length && <div className="empty">No matching records</div>}</section>
  </div>;
}

function Profile({ onBack }) { return <div className="content profile-page"><button className="back" onClick={onBack}>← Back to overview</button><div className="profile-hero"><div className="big-avatar">TC</div><div><p>PERSONAL PROFILE</p><h1>Tom Chezery</h1><span>Administrator · São Paulo, Brazil</span></div><button>Edit profile</button></div><section className="profile-form"><div><label>Full name</label><input defaultValue="Tom Chezery"/></div><div><label>Work email</label><input defaultValue="tom@northstar.studio"/></div><div><label>Role</label><input defaultValue="Administrator"/></div><div><label>Timezone</label><input defaultValue="America/Sao_Paulo"/></div><div className="wide"><label>Bio</label><textarea defaultValue="Building thoughtful software and better ways of working."/></div></section></div>; }

function Tour({ onClose }) { return <div className="tour-layer"><div className="spotlight"/><div className="tour-card"><span>STEP 1 OF 3</span><h3>Create a new invoice</h3><p>Start here. Alfred can also fill the invoice using a client and project you describe.</p><div><button onClick={onClose}>End tour</button><button onClick={onClose}>Got it <Icon name="arrow" size={14}/></button></div></div></div>; }

createRoot(document.getElementById('root')).render(<App />);
