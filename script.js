/* =========================================================
   DevKit — Main Script
   All tools, navigation, theme and clipboard logic.
   ========================================================= */

/* ---------- Tool registry ---------- */
const TOOLS = [
  { id: 'json',      name: 'JSON Formatter',    emoji: '{ }' },
  { id: 'base64',    name: 'Base64',            emoji: '🔐' },
  { id: 'url',       name: 'URL Encode',        emoji: '🔗' },
  { id: 'html',      name: 'HTML Entities',     emoji: '🏷️' },
  { id: 'color',     name: 'Color Picker',      emoji: '🎨' },
  { id: 'uuid',      name: 'UUID Generator',    emoji: '🆔' },
  { id: 'password',  name: 'Password',          emoji: '🔑' },
  { id: 'timestamp', name: 'Timestamp',         emoji: '🕒' },
  { id: 'qr',        name: 'QR Code',           emoji: '📱' },
  { id: 'lorem',     name: 'Lorem Ipsum',       emoji: '📝' },
  { id: 'case',      name: 'Text Case',         emoji: '🔤' },
  { id: 'counter',   name: 'Word Counter',      emoji: '🔢' },
  { id: 'minify',    name: 'Minify',            emoji: '📦' },
  { id: 'beautify',  name: 'Beautify',          emoji: '✨' },
  { id: 'escape',    name: 'Escape Text',       emoji: '🛡️' },
  { id: 'random',    name: 'Random Number',     emoji: '🎲' },
  { id: 'notes',     name: 'Notes',             emoji: '📒' },
];

/* ---------- DOM helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- Build sidebar ---------- */
function buildSidebar() {
  const list = $('#toolList');
  list.innerHTML = TOOLS.map(t =>
    `<a class="tool-link" data-target="${t.id}">
       <span class="emoji">${t.emoji}</span>
       <span>${t.name}</span>
     </a>`
  ).join('');

  list.querySelectorAll('.tool-link').forEach(link => {
    link.addEventListener('click', () => showTool(link.dataset.target));
  });
}

/* ---------- Show tool ---------- */
function showTool(id) {
  $$('.tool').forEach(s => s.classList.toggle('active', s.dataset.tool === id));
  $$('.tool-link').forEach(l => l.classList.toggle('active', l.dataset.target === id));
  // close mobile sidebar
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
  // Update URL hash
  history.replaceState(null, '', '#' + id);
}

/* ---------- Sidebar toggle (mobile) ---------- */
$('#menuToggle').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
  $('#overlay').classList.toggle('show');
});
$('#overlay').addEventListener('click', () => {
  $('#sidebar').classList.remove('open');
  $('#overlay').classList.remove('show');
});

/* ---------- Search filter ---------- */
$('#toolSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  $$('.tool-link').forEach(link => {
    const match = link.textContent.toLowerCase().includes(q);
    link.style.display = match ? '' : 'none';
  });
});

/* ---------- Theme toggle ---------- */
const themeToggle = $('#themeToggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('devkit-theme', theme);
}
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
applyTheme(localStorage.getItem('devkit-theme') || 'dark');

/* ---------- Toast ---------- */
const toast = $('#toast');
let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

/* ---------- Clipboard ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard ✓');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
    showToast('Copied ✓');
  }
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy]');
  if (btn) {
    const el = document.getElementById(btn.dataset.copy);
    if (el) copyText(el.value || el.textContent);
  }
});

/* =========================================================
   TOOL IMPLEMENTATIONS
   ========================================================= */

/* ----- 1. JSON ----- */
function setStatus(id, msg, type = '') {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = 'status ' + type;
}
document.querySelector('[data-action="json-format"]').addEventListener('click', () => {
  try {
    const obj = JSON.parse($('#jsonInput').value);
    $('#jsonInput').value = JSON.stringify(obj, null, 2);
    setStatus('jsonStatus', '✓ Formatted', 'ok');
  } catch (e) { setStatus('jsonStatus', '✗ ' + e.message, 'err'); }
});
document.querySelector('[data-action="json-minify"]').addEventListener('click', () => {
  try {
    const obj = JSON.parse($('#jsonInput').value);
    $('#jsonInput').value = JSON.stringify(obj);
    setStatus('jsonStatus', '✓ Minified', 'ok');
  } catch (e) { setStatus('jsonStatus', '✗ ' + e.message, 'err'); }
});
document.querySelector('[data-action="json-validate"]').addEventListener('click', () => {
  try { JSON.parse($('#jsonInput').value); setStatus('jsonStatus', '✓ Valid JSON', 'ok'); }
  catch (e) { setStatus('jsonStatus', '✗ Invalid: ' + e.message, 'err'); }
});

/* ----- 2. Base64 ----- */
document.querySelector('[data-action="b64-encode"]').addEventListener('click', () => {
  try {
    $('#b64Input').value = btoa(unescape(encodeURIComponent($('#b64Input').value)));
    showToast('Encoded ✓');
  } catch (e) { showToast('Error: ' + e.message); }
});
document.querySelector('[data-action="b64-decode"]').addEventListener('click', () => {
  try {
    $('#b64Input').value = decodeURIComponent(escape(atob($('#b64Input').value.trim())));
    showToast('Decoded ✓');
  } catch (e) { showToast('Invalid Base64'); }
});

/* ----- 3. URL ----- */
document.querySelector('[data-action="url-encode"]').addEventListener('click', () => {
  $('#urlInput').value = encodeURIComponent($('#urlInput').value);
});
document.querySelector('[data-action="url-decode"]').addEventListener('click', () => {
  try { $('#urlInput').value = decodeURIComponent($('#urlInput').value); }
  catch { showToast('Invalid URL encoding'); }
});

/* ----- 4. HTML Entities ----- */
const htmlEntities = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
document.querySelector('[data-action="html-encode"]').addEventListener('click', () => {
  $('#htmlInput').value = $('#htmlInput').value.replace(/[&<>"']/g, c => htmlEntities[c]);
});
document.querySelector('[data-action="html-decode"]').addEventListener('click', () => {
  const ta = document.createElement('textarea');
  ta.innerHTML = $('#htmlInput').value;
  $('#htmlInput').value = ta.value;
});

/* ----- 5. Color Picker ----- */
function hexToRgb(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const n = parseInt(hex, 16);
  return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
}
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if (max===min) { h=s=0; }
  else {
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d + (g<b?6:0); break;
      case g: h=(b-r)/d + 2; break;
      case b: h=(r-g)/d + 4; break;
    }
    h/=6;
  }
  return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
}
function updateColor(hex) {
  const { r,g,b } = hexToRgb(hex);
  const { h,s,l } = rgbToHsl(r,g,b);
  $('#colorHex').value = hex.toUpperCase();
  $('#colorRgb').value = `rgb(${r}, ${g}, ${b})`;
  $('#colorHsl').value = `hsl(${h}, ${s}%, ${l}%)`;
  $('#colorPreview').style.background = hex;
}
$('#colorPicker').addEventListener('input', e => updateColor(e.target.value));
$('#colorHex').addEventListener('input', e => {
  const v = e.target.value;
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
    const hex = v.startsWith('#') ? v : '#'+v;
    $('#colorPicker').value = hex;
    updateColor(hex);
  }
});
updateColor('#6366f1');

/* ----- 6. UUID ----- */
function uuidv4() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
document.querySelector('[data-action="uuid-gen"]').addEventListener('click', () => {
  const n = Math.min(100, Math.max(1, parseInt($('#uuidCount').value) || 1));
  $('#uuidOutput').value = Array.from({length:n}, uuidv4).join('\n');
});

/* ----- 7. Password ----- */
$('#pwdLen').addEventListener('input', e => $('#pwdLenVal').textContent = e.target.value);
document.querySelector('[data-action="pwd-gen"]').addEventListener('click', () => {
  const len = parseInt($('#pwdLen').value);
  let chars = '';
  if ($('#pwdUpper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if ($('#pwdLower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
  if ($('#pwdNum').checked) chars += '0123456789';
  if ($('#pwdSym').checked) chars += '!@#$%^&*()-_=+[]{};:,.<>?';
  if (!chars) { showToast('Select at least one option'); return; }
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let pwd = '';
  for (let i=0; i<len; i++) pwd += chars[arr[i] % chars.length];
  $('#pwdOutput').value = pwd;
});

/* ----- 8. Timestamp ----- */
function syncTimestamps(from) {
  let date;
  if (from === 'unix') {
    const v = parseInt($('#tsUnix').value);
    if (isNaN(v)) return;
    date = new Date(v * 1000);
  } else {
    date = new Date($('#tsIso').value);
    if (isNaN(date)) return;
  }
  if (from !== 'unix') $('#tsUnix').value = Math.floor(date.getTime()/1000);
  if (from !== 'iso')  $('#tsIso').value = date.toISOString();
  $('#tsLocal').value = date.toString();
}
$('#tsUnix').addEventListener('input', () => syncTimestamps('unix'));
$('#tsIso').addEventListener('input', () => syncTimestamps('iso'));
document.querySelector('[data-action="ts-now"]').addEventListener('click', () => {
  const now = new Date();
  $('#tsUnix').value = Math.floor(now.getTime()/1000);
  $('#tsIso').value = now.toISOString();
  $('#tsLocal').value = now.toString();
});
// init
(() => { const n=new Date(); $('#tsUnix').value=Math.floor(n.getTime()/1000); $('#tsIso').value=n.toISOString(); $('#tsLocal').value=n.toString(); })();

/* ----- 9. QR Code ----- */
document.querySelector('[data-action="qr-gen"]').addEventListener('click', () => {
  const text = $('#qrInput').value.trim();
  if (!text) { showToast('Enter text first'); return; }
  const wrap = $('#qrWrap');
  wrap.innerHTML = '';
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    wrap.innerHTML = qr.createImgTag(6, 8);
  } catch (e) {
    wrap.innerHTML = '<span style="color:#ef4444">Failed to generate QR</span>';
  }
});

/* ----- 10. Lorem Ipsum ----- */
const LOREM_WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum".split(' ');
function loremParagraph() {
  const len = 40 + Math.floor(Math.random()*40);
  const words = [];
  for (let i=0; i<len; i++) words.push(LOREM_WORDS[Math.floor(Math.random()*LOREM_WORDS.length)]);
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ') + '.';
}
document.querySelector('[data-action="lorem-gen"]').addEventListener('click', () => {
  const n = Math.min(50, Math.max(1, parseInt($('#loremCount').value) || 1));
  $('#loremOutput').value = Array.from({length:n}, loremParagraph).join('\n\n');
});

/* ----- 11. Text Case ----- */
const caseInput = $('#caseInput');
function applyCase(fn) { caseInput.value = fn(caseInput.value); }
document.querySelector('[data-action="case-upper"]').addEventListener('click', () => applyCase(s => s.toUpperCase()));
document.querySelector('[data-action="case-lower"]').addEventListener('click', () => applyCase(s => s.toLowerCase()));
document.querySelector('[data-action="case-title"]').addEventListener('click', () => applyCase(s => s.replace(/\w\S*/g, w => w[0].toUpperCase()+w.slice(1).toLowerCase())));
document.querySelector('[data-action="case-sentence"]').addEventListener('click', () => applyCase(s => s.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase())));
document.querySelector('[data-action="case-camel"]').addEventListener('click', () => applyCase(s => s.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_,c) => c.toUpperCase())));
document.querySelector('[data-action="case-snake"]').addEventListener('click', () => applyCase(s => s.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g,'')));
document.querySelector('[data-action="case-kebab"]').addEventListener('click', () => applyCase(s => s.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g,'')));

/* ----- 12. Word Counter ----- */
$('#counterInput').addEventListener('input', e => {
  const t = e.target.value;
  $('#statChars').textContent = t.length;
  $('#statNoSpace').textContent = t.replace(/\s/g,'').length;
  $('#statWords').textContent = t.trim() ? t.trim().split(/\s+/).length : 0;
  $('#statLines').textContent = t ? t.split('\n').length : 0;
  const mins = (t.trim().split(/\s+/).filter(Boolean).length / 200);
  $('#statRead').textContent = mins < 1 ? Math.round(mins*60)+'s' : Math.round(mins)+'m';
});

/* ----- 13. Minify ----- */
function minifyHTML(s) {
  return s.replace(/<!--[\s\S]*?-->/g,'')
          .replace(/\s+/g,' ')
          .replace(/>\s+</g,'><')
          .trim();
}
function minifyCSS(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g,'')
          .replace(/\s+/g,' ')
          .replace(/\s*([{}:;,])\s*/g,'$1')
          .replace(/;}/g,'}')
          .trim();
}
function minifyJS(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g,'')
          .replace(/(^|[^:])\/\/.*$/gm,'$1')
          .replace(/\s+/g,' ')
          .replace(/\s*([{}();,:=])\s*/g,'$1')
          .trim();
}
document.querySelector('[data-action="minify-run"]').addEventListener('click', () => {
  const type = $('#minifyType').value;
  const input = $('#minifyInput');
  const before = input.value.length;
  if (type==='html') input.value = minifyHTML(input.value);
  else if (type==='css') input.value = minifyCSS(input.value);
  else input.value = minifyJS(input.value);
  const after = input.value.length;
  const saved = before - after;
  const pct = before ? Math.round(saved/before*100) : 0;
  setStatus('minifyStatus', `✓ Saved ${saved} chars (${pct}%)`, 'ok');
});

/* ----- 14. Beautify ----- */
function beautifyHTML(s) {
  const voidTags = /^area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr$/i;
  let out = '', indent = 0;
  s = s.replace(/>\s+</g,'><').replace(/</g,'\n<').trim().split('\n');
  s.forEach(line => {
    line = line.trim();
    if (!line) return;
    if (/^<\//.test(line)) indent = Math.max(0, indent-1);
    out += '  '.repeat(indent) + line + '\n';
    if (/^<([a-z0-9]+)/i.test(line) && !voidTags.test(line.match(/^<([a-z0-9]+)/i)[1]) && !/\/>\s*$/.test(line) && !/<\/[^>]+>\s*$/.test(line)) indent++;
  });
  return out.trim();
}
function beautifyCSS(s) {
  return s.replace(/\s*{\s*/g,' {\n  ')
          .replace(/;\s*/g,';\n  ')
          .replace(/\s*}\s*/g,'\n}\n')
          .replace(/\n  \n/g,'\n')
          .replace(/\n}/g,'\n}')
          .trim();
}
function beautifyJS(s) {
  let out = '', indent = 0;
  const lines = s.replace(/([{};])/g,'$1\n').split('\n').map(l=>l.trim()).filter(Boolean);
  lines.forEach(line => {
    if (/^}/.test(line)) indent = Math.max(0, indent-1);
    out += '  '.repeat(indent) + line + '\n';
    if (/{\s*$/.test(line) && !/}/.test(line)) indent++;
  });
  return out;
}
document.querySelector('[data-action="beautify-run"]').addEventListener('click', () => {
  const type = $('#beautifyType').value;
  const input = $('#beautifyInput');
  if (type==='html') input.value = beautifyHTML(input.value);
  else if (type==='css') input.value = beautifyCSS(input.value);
  else input.value = beautifyJS(input.value);
  showToast('Beautified ✓');
});

/* ----- 15. Escape ----- */
document.querySelector('[data-action="escape-js"]').addEventListener('click', () => {
  $('#escapeInput').value = JSON.stringify($('#escapeInput').value).slice(1,-1);
});
document.querySelector('[data-action="unescape-js"]').addEventListener('click', () => {
  try { $('#escapeInput').value = JSON.parse('"'+$('#escapeInput').value.replace(/"/g,'\\"')+'"'); }
  catch { showToast('Invalid escape sequence'); }
});
document.querySelector('[data-action="escape-regex"]').addEventListener('click', () => {
  $('#escapeInput').value = $('#escapeInput').value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
});

/* ----- 16. Random Number ----- */
document.querySelector('[data-action="rand-gen"]').addEventListener('click', () => {
  const min = parseInt($('#randMin').value);
  const max = parseInt($('#randMax').value);
  const count = Math.min(1000, Math.max(1, parseInt($('#randCount').value) || 1));
  if (min > max) { showToast('Min must be ≤ Max'); return; }
  const arr = new Uint32Array(count);
  crypto.getRandomValues(arr);
  const range = max - min + 1;
  const nums = Array.from(arr, n => min + (n % range));
  $('#randOutput').value = nums.join('\n');
});

/* ----- 17. Notes (LocalStorage) ----- */
const notesInput = $('#notesInput');
const notesStatus = $('#notesStatus');
notesInput.value = localStorage.getItem('devkit-notes') || '';
let saveTimer;
notesInput.addEventListener('input', () => {
  notesStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem('devkit-notes', notesInput.value);
    notesStatus.textContent = 'Auto-saved ✓';
  }, 400);
});
document.querySelector('[data-action="notes-clear"]').addEventListener('click', () => {
  if (confirm('Clear all notes?')) {
    notesInput.value = '';
    localStorage.removeItem('devkit-notes');
    showToast('Notes cleared');
  }
});

/* ---------- Init ---------- */
buildSidebar();
const initialTool = location.hash.replace('#','') || 'json';
showTool(TOOLS.find(t => t.id === initialTool) ? initialTool : 'json');
