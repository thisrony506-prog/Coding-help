/* =========================================================
   DevStudio — Main Script
   Multi-file editor, live preview, dev tools, PWA.
   ========================================================= */

/* ---------- Storage keys ---------- */
const K_PROJECTS = 'devstudio_projects';
const K_ACTIVE   = 'devstudio_active';
const K_SETTINGS = 'devstudio_settings';

/* ---------- Default project template ---------- */
const DEFAULT_FILES = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, DevStudio!</h1>
  <p>Edit files on the left. Preview updates live.</p>
  <script src="script.js"><\/script>
</body>
</html>`,
  'style.css': `body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  min-height: 100vh;
  display: grid;
  place-items: center;
  margin: 0;
  text-align: center;
}
h1 { font-size: 3rem; margin: 0 0 1rem; }
p { opacity: 0.9; }`,
  'script.js': `console.log("DevStudio ready!");
document.querySelector("h1").addEventListener("click", () => {
  alert("It works!");
});`
};

/* ---------- State ---------- */
let state = {
  projects: {},
  activeProject: null,
  settings: {
    theme: 'dark',
    fontSize: 14,
    wordWrap: false,
    autoSave: true,
    tabSize: 2
  }
};
let saveTimer = null;

/* ---------- DOM helpers ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- Load / Save state ---------- */
function loadState() {
  try {
    state.projects = JSON.parse(localStorage.getItem(K_PROJECTS) || '{}');
    state.activeProject = localStorage.getItem(K_ACTIVE);
    state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(K_SETTINGS) || '{}') };
  } catch (e) { console.warn('Load failed', e); }

  // Ensure at least one project
  if (Object.keys(state.projects).length === 0) {
    const id = createProject('My First Project');
    state.activeProject = id;
  }
  if (!state.projects[state.activeProject]) {
    state.activeProject = Object.keys(state.projects)[0];
  }
}

function persist() {
  localStorage.setItem(K_PROJECTS, JSON.stringify(state.projects));
  localStorage.setItem(K_ACTIVE, state.activeProject);
  localStorage.setItem(K_SETTINGS, JSON.stringify(state.settings));
}

function scheduleSave() {
  if (!state.settings.autoSave) return;
  $('#statusSave').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist();
    $('#statusSave').textContent = 'Saved';
  }, 400);
}

/* ---------- Project operations ---------- */
function createProject(name) {
  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  state.projects[id] = {
    id,
    name: name || 'Untitled Project',
    created: Date.now(),
    modified: Date.now(),
    files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
    activeFile: 'index.html'
  };
  persist();
  return id;
}

function currentProject() { return state.projects[state.activeProject]; }
function currentFile() {
  const p = currentProject();
  return p ? p.files[p.activeFile] : null;
}

/* ---------- UI: Sidebar tabs ---------- */
$$('.stab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.stab').forEach(b => b.classList.toggle('active', b === btn));
    $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.panel));
  });
});

/* ---------- UI: File list ---------- */
function renderFileList() {
  const p = currentProject();
  const list = $('#fileList');
  list.innerHTML = '';
  if (!p) return;
  Object.keys(p.files).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    const ext = document.createElement('span');
    ext.className = 'ext';
    ext.textContent = name.split('.').pop();
    li.appendChild(ext);
    if (name === p.activeFile) li.classList.add('active');
    li.addEventListener('click', () => openFile(name));
    list.appendChild(li);
  });
}

function renderProjectList() {
  const list = $('#projectList');
  list.innerHTML = '';
  Object.values(state.projects).forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (p.id === state.activeProject) li.classList.add('active');
    li.addEventListener('click', () => switchProject(p.id));
    list.appendChild(li);
  });
}

function renderTabs() {
  const p = currentProject();
  const bar = $('#tabsBar');
  bar.innerHTML = '';
  if (!p) return;
  Object.keys(p.files).forEach(name => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (name === p.activeFile ? ' active' : '');
    tab.innerHTML = `<span>${name}</span><span class="close" title="Close">×</span>`;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('close')) {
        e.stopPropagation();
        closeFile(name);
      } else {
        openFile(name);
      }
    });
    bar.appendChild(tab);
  });
}

/* ---------- File operations ---------- */
function openFile(name) {
  const p = currentProject();
  if (!p || !p.files[name]) return;
  p.activeFile = name;
  const f = p.files[name];
  $('#editor').value = f.content;
  $('#projectName').textContent = p.name;
  $('#statusFile').textContent = name;
  updateHighlight();
  updateGutter();
  updateStatus();
  renderFileList();
  renderTabs();
  scheduleSave();
  runDiagnostics();
}

function closeFile(name) {
  const p = currentProject();
  if (!p) return;
  const keys = Object.keys(p.files);
  if (keys.length <= 1) { showToast('Cannot close last file'); return; }
  delete p.files[name];
  if (p.activeFile === name) p.activeFile = Object.keys(p.files)[0];
  openFile(p.activeFile);
  scheduleSave();
}

function newFile() {
  showModal('New File', `
    <label>File name</label>
    <input type="text" id="newFileName" placeholder="example.js" value="untitled.js" />
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Create', primary: true, action: () => {
      const name = $('#newFileName').value.trim();
      if (!name) return;
      const p = currentProject();
      if (p.files[name]) { showToast('File exists'); return; }
      p.files[name] = { content: '', lang: langFromExt(name) };
      p.modified = Date.now();
      openFile(name);
      closeModal();
    }}
  ]);
}

function renameFile() {
  const p = currentProject();
  const oldName = p.activeFile;
  showModal('Rename File', `
    <label>New name</label>
    <input type="text" id="renameInput" value="${oldName}" />
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Rename', primary: true, action: () => {
      const newName = $('#renameInput').value.trim();
      if (!newName || newName === oldName) { closeModal(); return; }
      if (p.files[newName]) { showToast('File exists'); return; }
      p.files[newName] = p.files[oldName];
      delete p.files[oldName];
      p.activeFile = newName;
      openFile(newName);
      closeModal();
    }}
  ]);
}

function deleteFile() {
  const p = currentProject();
  if (Object.keys(p.files).length <= 1) { showToast('Cannot delete last file'); return; }
  if (!confirm(`Delete "${p.activeFile}"?`)) return;
  delete p.files[p.activeFile];
  p.activeFile = Object.keys(p.files)[0];
  openFile(p.activeFile);
  scheduleSave();
}

function langFromExt(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'mjs') return 'js';
  if (ext === 'json') return 'json';
  return 'text';
}

/* ---------- Project operations ---------- */
function switchProject(id) {
  state.activeProject = id;
  persist();
  const p = currentProject();
  openFile(p.activeFile);
  renderProjectList();
}

function newProject() {
  showModal('New Project', `
    <label>Project name</label>
    <input type="text" id="newProjName" value="New Project" />
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Create', primary: true, action: () => {
      const name = $('#newProjName').value.trim() || 'Untitled';
      const id = createProject(name);
      switchProject(id);
      closeModal();
    }}
  ]);
}

function duplicateProject() {
  const p = currentProject();
  const id = createProject(p.name + ' (copy)');
  state.projects[id].files = JSON.parse(JSON.stringify(p.files));
  switchProject(id);
  showToast('Project duplicated');
}

function deleteProject() {
  if (Object.keys(state.projects).length <= 1) { showToast('Cannot delete last project'); return; }
  if (!confirm(`Delete project "${currentProject().name}"?`)) return;
  delete state.projects[state.activeProject];
  state.activeProject = Object.keys(state.projects)[0];
  persist();
  const p = currentProject();
  openFile(p.activeFile);
  renderProjectList();
}

/* ---------- Export / Import ZIP ---------- */
async function exportZip() {
  if (typeof JSZip === 'undefined') { showToast('JSZip not loaded'); return; }
  const p = currentProject();
  const zip = new JSZip();
  const folder = zip.folder(p.name.replace(/[^a-z0-9]/gi, '_'));
  Object.entries(p.files).forEach(([name, f]) => folder.file(name, f.content));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, p.name + '.zip');
  showToast('Exported ZIP');
}

async function importZip(file) {
  if (typeof JSZip === 'undefined') { showToast('JSZip not loaded'); return; }
  try {
    const zip = await JSZip.loadAsync(file);
    const files = {};
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      // Skip nested folders - flatten
      const baseName = name.split('/').pop();
      if (!baseName) continue;
      files[baseName] = { content: await entry.async('string'), lang: langFromExt(baseName) };
    }
    if (Object.keys(files).length === 0) { showToast('No files in ZIP'); return; }
    const name = file.name.replace(/\.zip$/i, '');
    const id = createProject(name);
    state.projects[id].files = files;
    state.projects[id].activeFile = files['index.html'] ? 'index.html' : Object.keys(files)[0];
    switchProject(id);
    showToast('Imported project');
  } catch (e) { showToast('Import failed: ' + e.message); }
}

function downloadHtml() {
  const p = currentProject();
  const html = p.files['index.html']?.content || '';
  const css = p.files['style.css']?.content || '';
  const js = p.files['script.js']?.content || '';
  // Inline CSS and JS into a single HTML file
  let out = html;
  out = out.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']style\.css["'][^>]*>/i,
    `<style>\n${css}\n</style>`);
  out = out.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i,
    `<script>\n${js}\n<\/script>`);
  downloadBlob(new Blob([out], { type: 'text/html' }), p.name + '.html');
  showToast('Downloaded HTML');
}

async function shareProject() {
  const p = currentProject();
  const data = { name: p.name, files: p.files };
  const json = JSON.stringify(data);
  // Try Web Share API with files
  if (navigator.canShare && typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    Object.entries(p.files).forEach(([n, f]) => zip.file(n, f.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const file = new File([blob], p.name + '.zip', { type: 'application/zip' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: p.name }); return; }
      catch (e) { /* fall through */ }
    }
  }
  // Fallback: copy JSON to clipboard
  try {
    await navigator.clipboard.writeText(json);
    showToast('Project JSON copied');
  } catch {
    showToast('Share not supported');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Editor ---------- */
const editor = $('#editor');
const highlight = $('#highlight');
const gutter = $('#gutter');
const errorLineEl = $('#errorLine');

function updateHighlight() {
  const f = currentFile();
  if (!f) return;
  const lang = langFromName(f);
  highlight.innerHTML = syntaxHighlight(editor.value, lang);
  // Keep trailing newline for correct sizing
  if (editor.value.endsWith('\n')) highlight.innerHTML += '\n';
}

function langFromName(f) {
  // infer from active file name
  const p = currentProject();
  return langFromExt(p.activeFile);
}

function updateGutter() {
  const lines = editor.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) html += i + '\n';
  gutter.textContent = html;
}

function updateStatus() {
  const val = editor.value;
  const pos = editor.selectionStart;
  const before = val.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  $('#statusCursor').textContent = `Ln ${line}, Col ${col}`;
  const bytes = new Blob([val]).size;
  $('#statusSize').textContent = bytes < 1024 ? bytes + ' B' : (bytes/1024).toFixed(1) + ' KB';
}

function syncScroll() {
  highlight.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
  gutter.scrollTop = editor.scrollTop;
}

editor.addEventListener('input', () => {
  const p = currentProject();
  if (!p) return;
  p.files[p.activeFile].content = editor.value;
  p.modified = Date.now();
  updateHighlight();
  updateGutter();
  updateStatus();
  scheduleSave();
  schedulePreview();
  runDiagnostics();
});
editor.addEventListener('scroll', syncScroll);
editor.addEventListener('click', updateStatus);
editor.addEventListener('keyup', updateStatus);

/* ---------- Editor features: Tab, auto-close, auto-indent ---------- */
editor.addEventListener('keydown', (e) => {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const val = editor.value;

  // Tab key
  if (e.key === 'Tab') {
    e.preventDefault();
    const spaces = ' '.repeat(state.settings.tabSize);
    if (start === end) {
      insertText(spaces);
    } else {
      // indent selection
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const selected = val.slice(lineStart, end);
      const indented = e.shiftKey
        ? selected.replace(new RegExp(`^ {1,${state.settings.tabSize}}`, 'gm'), '')
        : selected.replace(/^/gm, spaces);
      editor.setSelectionRange(lineStart, end);
      insertText(indented);
      editor.setSelectionRange(lineStart, lineStart + indented.length);
    }
    return;
  }

  // Enter - auto indent
  if (e.key === 'Enter') {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const currentLine = val.slice(lineStart, start);
    const indent = currentLine.match(/^\s*/)[0];
    const lastChar = val[start - 1];
    const nextChar = val[start];
    let extra = '';
    if ((lastChar === '{' && nextChar === '}') ||
        (lastChar === '(' && nextChar === ')') ||
        (lastChar === '[' && nextChar === ']')) {
      extra = '\n' + indent + ' '.repeat(state.settings.tabSize);
      insertText(extra + '\n' + indent);
      editor.setSelectionRange(start + extra.length, start + extra.length);
      e.preventDefault();
      return;
    }
    insertText('\n' + indent);
    e.preventDefault();
    return;
  }

  // Auto-close brackets/quotes
  const pairs = { '(':')', '[':']', '{':'}', '"':'"', "'":"'", '`':'`' };
  if (pairs[e.key] && start === end) {
    // Only auto-close if not typing a quote inside a word
    if ('"\'`'.includes(e.key)) {
      const before = val[start - 1];
      if (before && /\w/.test(before)) return;
    }
    insertText(e.key + pairs[e.key]);
    editor.setSelectionRange(start + 1, start + 1);
    e.preventDefault();
    return;
  }

  // Skip over closing bracket if next char matches
  if (')]}\'"`'.includes(e.key) && val[start] === e.key) {
    editor.setSelectionRange(start + 1, start + 1);
    e.preventDefault();
    return;
  }

  // Auto-close HTML tags on >
  if (e.key === '>' && isHtmlFile()) {
    const before = val.slice(0, start);
    const match = before.match(/<([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*$/);
    if (match) {
      const tag = match[1];
      const voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
      if (!voidTags.test(tag)) {
        const close = `</${tag}>`;
        insertText('>' + close);
        editor.setSelectionRange(start + 1, start + 1);
        e.preventDefault();
        return;
      }
    }
  }
});

function insertText(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const val = editor.value;
  editor.value = val.slice(0, start) + text + val.slice(end);
  editor.selectionStart = editor.selectionEnd = start + text.length;
  editor.dispatchEvent(new Event('input'));
}

function isHtmlFile() {
  const p = currentProject();
  return p && langFromExt(p.activeFile) === 'html';
}

/* ---------- Syntax Highlighter ---------- */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syntaxHighlight(code, lang) {
  if (lang === 'html') return highlightHtml(code);
  if (lang === 'css') return highlightCss(code);
  if (lang === 'js' || lang === 'json') return highlightJs(code);
  return escapeHtml(code);
}

function highlightHtml(code) {
  // Tokenize: comments, tags, attributes, strings, text
  let out = '';
  let i = 0;
  while (i < code.length) {
    // Comment
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i);
      const stop = end === -1 ? code.length : end + 3;
      out += `<span class="tok-com">${escapeHtml(code.slice(i, stop))}</span>`;
      i = stop; continue;
    }
    // Tag
    if (code[i] === '<') {
      const end = code.indexOf('>', i);
      if (end === -1) { out += escapeHtml(code.slice(i)); break; }
      const tag = code.slice(i, end + 1);
      out += highlightTag(tag);
      i = end + 1; continue;
    }
    // Script/style content — still plain text here
    const next = code.indexOf('<', i);
    const stop = next === -1 ? code.length : next;
    out += escapeHtml(code.slice(i, stop));
    i = stop;
  }
  return out;
}

function highlightTag(tag) {
  // Match opening <, optional /, tag name, attributes, optional /, >
  let out = '<span class="tok-punc">&lt;</span>';
  let i = 1;
  if (tag[i] === '/') { out += '<span class="tok-punc">/</span>'; i++; }
  const nameMatch = tag.slice(i).match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (nameMatch) {
    out += `<span class="tok-tag">${nameMatch[1]}</span>`;
    i += nameMatch[1].length;
  }
  // Attributes
  while (i < tag.length - 1) {
    const ch = tag[i];
    if (/\s/.test(ch)) { out += ch; i++; continue; }
    if (ch === '/' && tag[i+1] === '>') {
      out += '<span class="tok-punc">/&gt;</span>';
      return out;
    }
    if (ch === '>') { out += '<span class="tok-punc">&gt;</span>'; return out; }
    // attribute name
    const attrMatch = tag.slice(i).match(/^([a-zA-Z_:][\w:.-]*)/);
    if (attrMatch) {
      out += `<span class="tok-attr">${attrMatch[1]}</span>`;
      i += attrMatch[1].length;
      // = value
      if (tag[i] === '=') {
        out += '<span class="tok-punc">=</span>';
        i++;
        const q = tag[i];
        if (q === '"' || q === "'") {
          const end = tag.indexOf(q, i + 1);
          const stop = end === -1 ? tag.length - 1 : end + 1;
          out += `<span class="tok-str">${escapeHtml(tag.slice(i, stop))}</span>`;
          i = stop;
        } else {
          const m = tag.slice(i).match(/^[^\s>]+/);
          if (m) { out += `<span class="tok-str">${escapeHtml(m[0])}</span>`; i += m[0].length; }
        }
      }
      continue;
    }
    out += escapeHtml(ch); i++;
  }
  if (tag.endsWith('>')) out += '<span class="tok-punc">&gt;</span>';
  return out;
}

function highlightCss(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    // Comment
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i);
      const stop = end === -1 ? code.length : end + 2;
      out += `<span class="tok-com">${escapeHtml(code.slice(i, stop))}</span>`;
      i = stop; continue;
    }
    // String
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== q) { if (code[j] === '\\') j++; j++; }
      out += `<span class="tok-str">${escapeHtml(code.slice(i, j+1))}</span>`;
      i = j + 1; continue;
    }
    // Block: selector { ... }
    if (code[i] !== '}' && !inPropertyContext(code, i)) {
      // selector until {
      const end = code.indexOf('{', i);
      if (end === -1) { out += escapeHtml(code.slice(i)); break; }
      out += `<span class="tok-sel">${escapeHtml(code.slice(i, end))}</span>`;
      out += '<span class="tok-punc">{</span>';
      i = end + 1;
      // properties until }
      while (i < code.length && code[i] !== '}') {
        if (code.startsWith('/*', i)) {
          const e = code.indexOf('*/', i);
          const s = e === -1 ? code.length : e + 2;
          out += `<span class="tok-com">${escapeHtml(code.slice(i, s))}</span>`;
          i = s; continue;
        }
        // property: value;
        const colon = code.indexOf(':', i);
        const semi = code.indexOf(';', i);
        const close = code.indexOf('}', i);
        if (colon === -1 || colon > close) {
          out += escapeHtml(code.slice(i, close === -1 ? code.length : close));
          i = close === -1 ? code.length : close;
          break;
        }
        const propName = code.slice(i, colon).trim();
        out += escapeHtml(code.slice(i, colon - propName.length));
        out += `<span class="tok-prop">${escapeHtml(propName)}</span>`;
        out += '<span class="tok-punc">:</span>';
        const valEnd = semi === -1 ? (close === -1 ? code.length : close) : semi;
        out += `<span class="tok-str">${escapeHtml(code.slice(colon+1, valEnd))}</span>`;
        if (semi !== -1 && semi < (close === -1 ? Infinity : close)) {
          out += '<span class="tok-punc">;</span>';
          i = semi + 1;
        } else {
          i = valEnd;
        }
      }
      if (i < code.length && code[i] === '}') {
        out += '<span class="tok-punc">}</span>';
        i++;
      }
      continue;
    }
    out += escapeHtml(code[i]); i++;
  }
  return out;
}

function inPropertyContext(code, i) {
  // simplistic: count unmatched { vs }
  let depth = 0;
  for (let k = 0; k < i; k++) {
    if (code[k] === '{') depth++;
    else if (code[k] === '}') depth--;
  }
  return depth > 0;
}

function highlightJs(code) {
  const keywords = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|class|extends|new|this|super|import|export|from|as|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|yield|null|undefined|true|false)\b/g;
  let out = '';
  let i = 0;
  while (i < code.length) {
    // Line comment
    if (code[i] === '/' && code[i+1] === '/') {
      const end = code.indexOf('\n', i);
      const stop = end === -1 ? code.length : end;
      out += `<span class="tok-com">${escapeHtml(code.slice(i, stop))}</span>`;
      i = stop; continue;
    }
    // Block comment
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i);
      const stop = end === -1 ? code.length : end + 2;
      out += `<span class="tok-com">${escapeHtml(code.slice(i, stop))}</span>`;
      i = stop; continue;
    }
    // String
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const q = code[i];
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === q) { j++; break; }
        j++;
      }
      out += `<span class="tok-str">${escapeHtml(code.slice(i, j))}</span>`;
      i = j; continue;
    }
    // Number
    if (/\d/.test(code[i])) {
      const m = code.slice(i).match(/^\d+(\.\d+)?([eE][+-]?\d+)?/);
      if (m) { out += `<span class="tok-num">${m[0]}</span>`; i += m[0].length; continue; }
    }
    // Identifier / keyword
    if (/[a-zA-Z_$]/.test(code[i])) {
      const m = code.slice(i).match(/^[a-zA-Z_$][\w$]*/);
      if (m) {
        const word = m[0];
        if (/^(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|class|extends|new|this|super|import|export|from|as|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|yield|null|undefined|true|false)$/.test(word)) {
          out += `<span class="tok-kw">${word}</span>`;
        } else {
          out += word;
        }
        i += word.length; continue;
      }
    }
    out += escapeHtml(code[i]); i++;
  }
  return out;
}

/* ---------- Live Preview ---------- */
const preview = $('#preview');
let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
}
function updatePreview() {
  const p = currentProject();
  if (!p) return;
  const html = p.files['index.html']?.content || '';
  const css = p.files['style.css']?.content || '';
  const js = p.files['script.js']?.content || '';
  // Build a self-contained document
  let doc = html;
  // Inject CSS if not linked
  if (!/<link[^>]*href=["']style\.css["']/i.test(doc)) {
    doc = doc.replace('</head>', `<style>\n${css}\n</style>\n</head>`);
  } else {
    // Replace link with inline style
    doc = doc.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>\n${css}\n</style>`);
  }
  if (!/<script[^>]*src=["']script\.js["']/i.test(doc)) {
    doc = doc.replace('</body>', `<script>\n${js}\n<\/script>\n</body>`);
  } else {
    doc = doc.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>\n${js}\n<\/script>`);
  }
  preview.srcdoc = doc;
}
$('#btnRefresh').addEventListener('click', updatePreview);
$('#btnPreviewFull').addEventListener('click', () => {
  document.body.classList.toggle('preview-full');
});
$('#btnNewTab').addEventListener('click', () => {
  const p = currentProject();
  const html = p.files['index.html']?.content || '';
  const css = p.files['style.css']?.content || '';
  const js = p.files['script.js']?.content || '';
  let doc = html.replace('</head>', `<style>${css}</style></head>`)
                 .replace('</body>', `<script>${js}<\/script></body>`);
  const blob = new Blob([doc], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
});
$('#btnRun').addEventListener('click', updatePreview);

/* ---------- Diagnostics ---------- */
let diagTimer;
function runDiagnostics() {
  clearTimeout(diagTimer);
  diagTimer = setTimeout(_runDiagnostics, 300);
}
function _runDiagnostics() {
  const p = currentProject();
  if (!p) return;
  const errors = [];
  // JS syntax check
  if (p.files['script.js']) {
    const jsErr = checkJsSyntax(p.files['script.js'].content);
    if (jsErr) errors.push({ file: 'script.js', ...jsErr });
  }
  // CSS check
  if (p.files['style.css']) {
    const cssErr = checkCssSyntax(p.files['style.css'].content);
    cssErr.forEach(e => errors.push({ file: 'style.css', ...e }));
  }
  // HTML check
  if (p.files['index.html']) {
    const htmlErr = checkHtmlSyntax(p.files['index.html'].content);
    htmlErr.forEach(e => errors.push({ file: 'index.html', ...e }));
  }
  renderErrors(errors);
}

function checkJsSyntax(code) {
  try {
    // new Function parses without executing
    new Function(code);
    return null;
  } catch (e) {
    // Try to extract line number
    let line = 1;
    const m = e.message.match(/line (\d+)/i) || e.stack?.match(/<anonymous>:(\d+)/);
    if (m) line = parseInt(m[1]);
    return { line, msg: e.message };
  }
}

function checkCssSyntax(code) {
  const errors = [];
  // Check brace balance
  let depth = 0;
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // skip comments
    const line = lines[i].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '');
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth < 0) {
        errors.push({ line: i+1, msg: `Unexpected '}'` });
        depth = 0;
      }
    }
  }
  if (depth > 0) errors.push({ line: lines.length, msg: `Missing ${depth} closing '}'` });

  // Check for missing semicolons in property lines (simple heuristic)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith('//') || l.startsWith('/*') || l.endsWith('*/')) continue;
    if (l.endsWith('{') || l.endsWith('}') || l.endsWith(',') || l.endsWith(':')) continue;
    if (l.startsWith('@') || l.startsWith('.') || l.startsWith('#') || /^[a-zA-Z0-9_*:[\]=~^$|-]/.test(l) && l.includes('{')) continue;
    // Inside a block: property: value should end with ;
    if (/^[a-z-]+\s*:/.test(l) && !l.endsWith(';') && !l.endsWith('}')) {
      errors.push({ line: i+1, msg: `Possible missing ';'` });
    }
  }
  return errors;
}

function checkHtmlSyntax(code) {
  const errors = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      errors.push({ line: 1, msg: parserError.textContent.slice(0, 120) });
    }
  } catch (e) {
    errors.push({ line: 1, msg: e.message });
  }
  // Check unclosed tags (simple)
  const stack = [];
  const voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*?>/g;
  let m;
  const lines = code.split('\n');
  while ((m = tagRe.exec(code)) !== null) {
    const full = m[0];
    const name = m[1];
    if (voidTags.test(name)) continue;
    if (full.startsWith('</')) {
      if (stack.length && stack[stack.length-1].name === name) stack.pop();
      else if (stack.length) {
        const line = code.slice(0, m.index).split('\n').length;
        errors.push({ line, msg: `Unexpected closing </${name}>` });
      }
    } else if (!full.endsWith('/>')) {
      stack.push({ name, pos: m.index });
    }
  }
  stack.forEach(s => {
    const line = code.slice(0, s.pos).split('\n').length;
    errors.push({ line, msg: `Unclosed <${s.name}>` });
  });
  return errors;
}

function renderErrors(errors) {
  const panel = $('#errorPanel');
  const list = $('#errorList');
  const status = $('#statusErrors');
  list.innerHTML = '';
  if (errors.length === 0) {
    status.textContent = '✓ No errors';
    status.style.color = 'var(--success)';
    panel.style.display = 'none';
    errorLineEl.style.display = 'none';
    return;
  }
  status.textContent = `⚠ ${errors.length} error${errors.length>1?'s':''}`;
  status.style.color = 'var(--danger)';
  errors.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="err-file">${e.file}</span><span class="err-line">Ln ${e.line}</span><span class="err-msg">${escapeHtml(e.msg)}</span>`;
    list.appendChild(li);
  });
  panel.style.display = 'block';
  // Highlight first error line in current file
  const first = errors.find(e => e.file === currentProject()?.activeFile);
  if (first) highlightErrorLine(first.line);
  else errorLineEl.style.display = 'none';
}

function highlightErrorLine(line) {
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 22;
  errorLineEl.style.display = 'block';
  errorLineEl.style.top = (10 + (line - 1) * lineHeight - editor.scrollTop) + 'px';
}
editor.addEventListener('scroll', () => {
  syncScroll();
  // reposition error line
  const errors = [...$('#errorList').children];
  if (errors.length) {
    const first = errors[0];
    const line = parseInt(first.querySelector('.err-line').textContent.replace('Ln ',''));
    if (first.querySelector('.err-file').textContent === currentProject()?.activeFile) {
      highlightErrorLine(line);
    }
  }
});
$('#btnCloseErrors').addEventListener('click', () => $('#errorPanel').style.display = 'none');

/* ---------- Find / Replace ---------- */
$('#btnFind').addEventListener?.('click', toggleFind);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    toggleFind(true);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
    e.preventDefault();
    toggleFind(true);
    setTimeout(() => $('#replaceInput').focus(), 50);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    updatePreview();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    persist();
    showToast('Saved');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    newFile();
  }
});
function toggleFind(forceOpen) {
  const fb = $('#findbar');
  if (forceOpen || fb.style.display === 'none') {
    fb.style.display = 'flex';
    $('#findInput').focus();
  } else {
    fb.style.display = 'none';
  }
}
$('#btnCloseFind').addEventListener('click', () => $('#findbar').style.display = 'none');
$('#btnFindNext').addEventListener('click', findNext);
$('#btnReplace').addEventListener('click', replaceNext);
$('#btnReplaceAll').addEventListener('click', replaceAll);

let lastFindIndex = 0;
function findNext() {
  const q = $('#findInput').value;
  if (!q) return;
  const val = editor.value;
  const startFrom = editor.selectionEnd || 0;
  let idx = val.indexOf(q, startFrom);
  if (idx === -1) idx = val.indexOf(q);
  if (idx === -1) { $('#findStatus').textContent = 'Not found'; return; }
  editor.focus();
  editor.setSelectionRange(idx, idx + q.length);
  const count = (val.match(new RegExp(escapeRegex(q), 'g')) || []).length;
  $('#findStatus').textContent = `${count} match${count!==1?'es':''}`;
}
function replaceNext() {
  const q = $('#findInput').value;
  const r = $('#replaceInput').value;
  if (!q) return;
  const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (sel === q) insertText(r);
  findNext();
}
function replaceAll() {
  const q = $('#findInput').value;
  const r = $('#replaceInput').value;
  if (!q) return;
  const re = new RegExp(escapeRegex(q), 'g');
  const count = (editor.value.match(re) || []).length;
  editor.value = editor.value.replace(re, r);
  editor.dispatchEvent(new Event('input'));
  $('#findStatus').textContent = `Replaced ${count}`;
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ---------- Split handle (resizable) ---------- */
const splitHandle = $('#splitHandle');
const editorPane = $('#editorPane');
const previewPane = $('#previewPane');
let dragging = false;
splitHandle.addEventListener('mousedown', startDrag);
splitHandle.addEventListener('touchstart', startDrag, { passive: false });
function startDrag(e) {
  e.preventDefault();
  dragging = true;
  splitHandle.classList.add('dragging');
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('touchmove', onDrag, { passive: false });
  document.addEventListener('touchend', stopDrag);
}
function onDrag(e) {
  if (!dragging) return;
  const rect = $('#split').getBoundingClientRect();
  const isVertical = window.innerWidth <= 768;
  if (isVertical) {
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const pct = (y / rect.height) * 100;
    editorPane.style.flex = `0 0 ${Math.max(15, Math.min(85, pct))}%`;
  } else {
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const pct = (x / rect.width) * 100;
    editorPane.style.flex = `0 0 ${Math.max(20, Math.min(80, pct))}%`;
  }
}
function stopDrag() {
  dragging = false;
  splitHandle.classList.remove('dragging');
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', stopDrag);
}

/* ---------- Sidebar toggle ---------- */
$('#btnSidebar').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

/* ---------- Theme ---------- */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  state.settings.theme = t;
  localStorage.setItem(K_SETTINGS, JSON.stringify(state.settings));
}
$('#btnTheme').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

/* ---------- Settings ---------- */
$('#btnSettings').addEventListener('click', () => {
  const s = state.settings;
  showModal('Settings', `
    <label>Font size <input type="number" id="setFontSize" value="${s.fontSize}" min="10" max="28" /></label>
    <label>Tab size <input type="number" id="setTabSize" value="${s.tabSize}" min="1" max="8" /></label>
    <label>Word wrap <input type="checkbox" id="setWordWrap" ${s.wordWrap?'checked':''} /></label>
    <label>Auto save <input type="checkbox" id="setAutoSave" ${s.autoSave?'checked':''} /></label>
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Save', primary: true, action: () => {
      state.settings.fontSize = parseInt($('#setFontSize').value) || 14;
      state.settings.tabSize = parseInt($('#setTabSize').value) || 2;
      state.settings.wordWrap = $('#setWordWrap').checked;
      state.settings.autoSave = $('#setAutoSave').checked;
      applySettings();
      persist();
      closeModal();
    }}
  ]);
});
function applySettings() {
  const s = state.settings;
  document.documentElement.style.setProperty('--editor-font-size', s.fontSize + 'px');
  document.documentElement.style.setProperty('--tab-size', s.tabSize);
  document.body.classList.toggle('word-wrap', s.wordWrap);
}

/* ---------- Modal ---------- */
function showModal(title, bodyHtml, buttons = []) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  const footer = $('#modalFooter');
  footer.innerHTML = '';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.primary ? 'primary' : 'ghost');
    btn.textContent = b.label;
    btn.addEventListener('click', b.action);
    footer.appendChild(btn);
  });
  $('#modalBackdrop').classList.add('show');
}
function closeModal() { $('#modalBackdrop').classList.remove('show'); }
$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', (e) => {
  if (e.target === $('#modalBackdrop')) closeModal();
});

/* ---------- Tool Drawer ---------- */
const toolHandlers = {
  json: {
    title: 'JSON Formatter',
    render: () => `
      <textarea id="tJson" placeholder='{"hello":"world"}'></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="format">Format</button>
        <button class="mini-btn" data-do="minify">Minify</button>
        <button class="mini-btn" data-do="validate">Validate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>
      <div class="tool-output" id="tJsonOut">—</div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="format"]').onclick = () => {
        try { $('#tJsonOut').textContent = JSON.stringify(JSON.parse($('#tJson').value), null, 2); }
        catch(e) { $('#tJsonOut').textContent = '✗ ' + e.message; }
      };
      $('#toolBody').querySelector('[data-do="minify"]').onclick = () => {
        try { $('#tJsonOut').textContent = JSON.stringify(JSON.parse($('#tJson').value)); }
        catch(e) { $('#tJsonOut').textContent = '✗ ' + e.message; }
      };
      $('#toolBody').querySelector('[data-do="validate"]').onclick = () => {
        try { JSON.parse($('#tJson').value); $('#tJsonOut').textContent = '✓ Valid JSON'; }
        catch(e) { $('#tJsonOut').textContent = '✗ ' + e.message; }
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#tJsonOut').textContent);
    }
  },
  base64: {
    title: 'Base64 Encode / Decode',
    render: () => `
      <textarea id="tB64" placeholder="Text…"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="enc">Encode</button>
        <button class="mini-btn" data-do="dec">Decode</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>
      <div class="tool-output" id="tB64Out">—</div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="enc"]').onclick = () => {
        try { $('#tB64Out').textContent = btoa(unescape(encodeURIComponent($('#tB64').value))); }
        catch(e) { $('#tB64Out').textContent = '✗ ' + e.message; }
      };
      $('#toolBody').querySelector('[data-do="dec"]').onclick = () => {
        try { $('#tB64Out').textContent = decodeURIComponent(escape(atob($('#tB64').value.trim()))); }
        catch { $('#tB64Out').textContent = '✗ Invalid Base64'; }
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#tB64Out').textContent);
    }
  },
  url: {
    title: 'URL Encode / Decode',
    render: () => `
      <textarea id="tUrl" placeholder="https://example.com/?q=hello world"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="enc">Encode</button>
        <button class="mini-btn" data-do="dec">Decode</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>
      <div class="tool-output" id="tUrlOut">—</div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="enc"]').onclick = () => {
        $('#tUrlOut').textContent = encodeURIComponent($('#tUrl').value);
      };
      $('#toolBody').querySelector('[data-do="dec"]').onclick = () => {
        try { $('#tUrlOut').textContent = decodeURIComponent($('#tUrl').value); }
        catch { $('#tUrlOut').textContent = '✗ Invalid'; }
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#tUrlOut').textContent);
    }
  },
  htmlent: {
    title: 'HTML Entity Encode / Decode',
    render: () => `
      <textarea id="tHtml" placeholder="<div>Hello & welcome</div>"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="enc">Encode</button>
        <button class="mini-btn" data-do="dec">Decode</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>
      <div class="tool-output" id="tHtmlOut">—</div>`,
    bind: () => {
      const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
      $('#toolBody').querySelector('[data-do="enc"]').onclick = () => {
        $('#tHtmlOut').textContent = $('#tHtml').value.replace(/[&<>"']/g, c => map[c]);
      };
      $('#toolBody').querySelector('[data-do="dec"]').onclick = () => {
        const ta = document.createElement('textarea');
        ta.innerHTML = $('#tHtml').value;
        $('#tHtmlOut').textContent = ta.value;
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#tHtmlOut').textContent);
    }
  },
  password: {
    title: 'Password Generator',
    render: () => `
      <div class="tool-field"><label>Length: <span id="pLenV">16</span></label>
        <input type="range" id="pLen" min="4" max="64" value="16" /></div>
      <div class="tool-row">
        <label><input type="checkbox" id="pU" checked /> Upper</label>
        <label><input type="checkbox" id="pL" checked /> Lower</label>
        <label><input type="checkbox" id="pN" checked /> Numbers</label>
        <label><input type="checkbox" id="pS" checked /> Symbols</label>
      </div>
      <div class="tool-output" id="pOut">—</div>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      $('#pLen').oninput = e => $('#pLenV').textContent = e.target.value;
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        let c = '';
        if ($('#pU').checked) c += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if ($('#pL').checked) c += 'abcdefghijklmnopqrstuvwxyz';
        if ($('#pN').checked) c += '0123456789';
        if ($('#pS').checked) c += '!@#$%^&*()-_=+[]{};:,.<>?';
        if (!c) { $('#pOut').textContent = 'Select at least one option'; return; }
        const len = parseInt($('#pLen').value);
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        $('#pOut').textContent = Array.from(arr, n => c[n % c.length]).join('');
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#pOut').textContent);
    }
  },
  uuid: {
    title: 'UUID Generator',
    render: () => `
      <div class="tool-field"><label>Quantity</label>
        <input type="number" id="uCount" value="5" min="1" max="100" /></div>
      <div class="tool-output" id="uOut">—</div>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
        }));
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        const n = Math.min(100, Math.max(1, parseInt($('#uCount').value) || 1));
        $('#uOut').textContent = Array.from({length:n}, uuid).join('\n');
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#uOut').textContent);
    }
  },
  timestamp: {
    title: 'Timestamp Converter',
    render: () => `
      <div class="tool-field"><label>Unix (seconds)</label>
        <input type="number" id="tsU" /></div>
      <div class="tool-field"><label>ISO</label>
        <input type="text" id="tsI" /></div>
      <div class="tool-field"><label>Local</label>
        <input type="text" id="tsL" readonly /></div>
      <div class="tool-row">
        <button class="mini-btn" data-do="now">Use Now</button>
      </div>`,
    bind: () => {
      const sync = (from) => {
        let d;
        if (from === 'u') { const v = parseInt($('#tsU').value); if (isNaN(v)) return; d = new Date(v*1000); }
        else { d = new Date($('#tsI').value); if (isNaN(d)) return; }
        if (from !== 'u') $('#tsU').value = Math.floor(d.getTime()/1000);
        if (from !== 'i') $('#tsI').value = d.toISOString();
        $('#tsL').value = d.toString();
      };
      $('#tsU').oninput = () => sync('u');
      $('#tsI').oninput = () => sync('i');
      $('#toolBody').querySelector('[data-do="now"]').onclick = () => {
        const n = new Date();
        $('#tsU').value = Math.floor(n.getTime()/1000);
        $('#tsI').value = n.toISOString();
        $('#tsL').value = n.toString();
      };
      const n = new Date();
      $('#tsU').value = Math.floor(n.getTime()/1000);
      $('#tsI').value = n.toISOString();
      $('#tsL').value = n.toString();
    }
  },
  counter: {
    title: 'Word & Character Counter',
    render: () => `
      <textarea id="tCnt" placeholder="Type text…"></textarea>
      <div class="tool-output" id="tCntOut">—</div>`,
    bind: () => {
      $('#tCnt').oninput = () => {
        const t = $('#tCnt').value;
        const chars = t.length;
        const noSpace = t.replace(/\s/g,'').length;
        const words = t.trim() ? t.trim().split(/\s+/).length : 0;
        const lines = t ? t.split('\n').length : 0;
        const mins = words / 200;
        $('#tCntOut').textContent =
          `Characters: ${chars}\nWithout spaces: ${noSpace}\nWords: ${words}\nLines: ${lines}\nRead time: ${mins < 1 ? Math.round(mins*60)+'s' : Math.round(mins)+'m'}`;
      };
    }
  },
  color: {
    title: 'Color Picker & Converter',
    render: () => `
      <input type="color" id="cPick" value="#6366f1" style="width:100%;height:60px;border:none;background:transparent" />
      <div class="tool-field"><label>HEX</label><input type="text" id="cHex" value="#6366F1" /></div>
      <div class="tool-field"><label>RGB</label><input type="text" id="cRgb" readonly /></div>
      <div class="tool-field"><label>HSL</label><input type="text" id="cHsl" readonly /></div>`,
    bind: () => {
      const hex2rgb = h => {
        h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join('');
        const n = parseInt(h,16);
        return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
      };
      const rgb2hsl = (r,g,b) => {
        r/=255;g/=255;b/=255;
        const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
        let h,s,l=(mx+mn)/2;
        if (mx===mn) h=s=0;
        else { const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn);
          switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6; }
        return { h:Math.round(h*360), s:Math.round(s*100), l:Math.round(l*100) };
      };
      const upd = (hex) => {
        const {r,g,b} = hex2rgb(hex);
        const {h,s,l} = rgb2hsl(r,g,b);
        $('#cHex').value = hex.toUpperCase();
        $('#cRgb').value = `rgb(${r}, ${g}, ${b})`;
        $('#cHsl').value = `hsl(${h}, ${s}%, ${l}%)`;
      };
      $('#cPick').oninput = e => upd(e.target.value);
      $('#cHex').oninput = e => {
        const v = e.target.value;
        if (/^#?[0-9a-fA-F]{6}$/.test(v)) upd(v.startsWith('#')?v:'#'+v);
      };
      upd('#6366f1');
    }
  },
  gradient: {
    title: 'Gradient Generator',
    render: () => `
      <div class="tool-row">
        <input type="color" id="gC1" value="#6366f1" />
        <input type="color" id="gC2" value="#8b5cf6" />
        <select id="gDir">
          <option value="to right">→ Right</option>
          <option value="to left">← Left</option>
          <option value="to bottom">↓ Down</option>
          <option value="to top">↑ Up</option>
          <option value="to bottom right">↘ Diagonal</option>
          <option value="135deg">135°</option>
        </select>
      </div>
      <div id="gPreview" style="height:100px;border-radius:8px;border:1px solid var(--border)"></div>
      <div class="tool-output" id="gOut">—</div>
      <div class="tool-row">
        <button class="mini-btn" data-do="copy">Copy CSS</button>
      </div>`,
    bind: () => {
      const upd = () => {
        const c1 = $('#gC1').value, c2 = $('#gC2').value, d = $('#gDir').value;
        const css = `linear-gradient(${d}, ${c1}, ${c2})`;
        $('#gPreview').style.background = css;
        $('#gOut').textContent = `background: ${css};`;
      };
      $('#gC1').oninput = upd; $('#gC2').oninput = upd; $('#gDir').onchange = upd;
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#gOut').textContent);
      upd();
    }
  },
  lorem: {
    title: 'Lorem Ipsum',
    render: () => `
      <div class="tool-field"><label>Paragraphs</label>
        <input type="number" id="lCount" value="3" min="1" max="50" /></div>
      <textarea id="lOut" readonly style="min-height:180px"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat".split(' ');
      const para = () => {
        const n = 40 + Math.floor(Math.random()*40);
        const w = Array.from({length:n}, () => words[Math.floor(Math.random()*words.length)]);
        w[0] = w[0][0].toUpperCase() + w[0].slice(1);
        return w.join(' ') + '.';
      };
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        const n = Math.min(50, Math.max(1, parseInt($('#lCount').value) || 1));
        $('#lOut').value = Array.from({length:n}, para).join('\n\n');
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#lOut').value);
    }
  },
  qr: {
    title: 'QR Code Generator',
    render: () => `
      <textarea id="qIn" placeholder="Text or URL…"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
      </div>
      <div id="qOut" style="background:#fff;padding:16px;border-radius:8px;text-align:center;min-height:180px">—</div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        const t = $('#qIn').value.trim();
        if (!t) return;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(t)}`;
        $('#qOut').innerHTML = `<img src="${url}" alt="QR" style="max-width:100%" />`;
      };
    }
  },
  case: {
    title: 'Text Case Converter',
    render: () => `
      <textarea id="cIn" placeholder="Type text…"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="up">UPPER</button>
        <button class="mini-btn" data-do="lo">lower</button>
        <button class="mini-btn" data-do="ti">Title</button>
        <button class="mini-btn" data-do="se">Sentence</button>
        <button class="mini-btn" data-do="ca">camel</button>
        <button class="mini-btn" data-do="sn">snake</button>
        <button class="mini-btn" data-do="ke">kebab</button>
      </div>`,
    bind: () => {
      const apply = fn => $('#cIn').value = fn($('#cIn').value);
      $('#toolBody').querySelector('[data-do="up"]').onclick = () => apply(s => s.toUpperCase());
      $('#toolBody').querySelector('[data-do="lo"]').onclick = () => apply(s => s.toLowerCase());
      $('#toolBody').querySelector('[data-do="ti"]').onclick = () => apply(s => s.replace(/\w\S*/g, w => w[0].toUpperCase()+w.slice(1).toLowerCase()));
      $('#toolBody').querySelector('[data-do="se"]').onclick = () => apply(s => s.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase()));
      $('#toolBody').querySelector('[data-do="ca"]').onclick = () => apply(s => s.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_,c) => c.toUpperCase()));
      $('#toolBody').querySelector('[data-do="sn"]').onclick = () => apply(s => s.toLowerCase().replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_|_$/g,''));
      $('#toolBody').querySelector('[data-do="ke"]').onclick = () => apply(s => s.toLowerCase().replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,''));
    }
  },
  escape: {
    title: 'Escape / Unescape Text',
    render: () => `
      <textarea id="eIn" placeholder='He said "hello"'></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="ejs">Escape JS</button>
        <button class="mini-btn" data-do="uj">Unescape JS</button>
        <button class="mini-btn" data-do="erx">Escape Regex</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="ejs"]').onclick = () => {
        $('#eIn').value = JSON.stringify($('#eIn').value).slice(1,-1);
      };
      $('#toolBody').querySelector('[data-do="uj"]').onclick = () => {
        try { $('#eIn').value = JSON.parse('"'+$('#eIn').value.replace(/"/g,'\\"')+'"'); }
        catch { showToast('Invalid escape'); }
      };
      $('#toolBody').querySelector('[data-do="erx"]').onclick = () => {
        $('#eIn').value = $('#eIn').value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#eIn').value);
    }
  }
};

function openTool(id) {
  const t = toolHandlers[id];
  if (!t) return;
  $('#toolTitle').textContent = t.title;
  $('#toolBody').innerHTML = t.render();
  t.bind();
  $('#toolDrawer').classList.add('open');
}
$('#toolClose').addEventListener('click', () => $('#toolDrawer').classList.remove('open'));
$('#toolList').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-tool]');
  if (li) openTool(li.dataset.tool);
});

/* ---------- Clipboard ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied ✓');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
    showToast('Copied ✓');
  }
}

/* ---------- Toast ---------- */
const toast = $('#toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

/* ---------- Button bindings ---------- */
$('#btnNewFile').addEventListener('click', newFile);
$('#btnRenameFile').addEventListener('click', renameFile);
$('#btnDeleteFile').addEventListener('click', deleteFile);
$('#btnNewProject').addEventListener('click', newProject);
$('#btnDuplicate').addEventListener('click', duplicateProject);
$('#btnDeleteProject').addEventListener('click', deleteProject);
$('#btnExportZip').addEventListener('click', exportZip);
$('#btnImportZip').addEventListener('click', () => $('#zipInput').click());
$('#zipInput').addEventListener('change', e => {
  if (e.target.files[0]) importZip(e.target.files[0]);
  e.target.value = '';
});
$('#btnDownloadHtml').addEventListener('click', downloadHtml);
$('#btnShare').addEventListener('click', shareProject);

/* ---------- PWA: Install prompt ---------- */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#btnInstall').style.display = 'grid';
});
$('#btnInstall').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#btnInstall').style.display = 'none';
});

/* ---------- Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

/* ---------- Init ---------- */
function init() {
  loadState();
  applyTheme(state.settings.theme);
  applySettings();
  renderProjectList();
  renderFileList();
  const p = currentProject();
  if (p) openFile(p.activeFile);
  updatePreview();
}
init();
