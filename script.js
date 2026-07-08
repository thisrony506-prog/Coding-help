/* =========================================================
   DevStudio — Main Script (Fixed Version)
   ========================================================= */

const K_PROJECTS = 'devstudio_projects';
const K_ACTIVE = 'devstudio_active';
const K_SETTINGS = 'devstudio_settings';

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
  <p>Edit files on the left.</p>
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
h1 { font-size: 3rem; }`,
  'script.js': `console.log("DevStudio ready!");`
};

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

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

/* ---------- Load/Save ---------- */
function loadState() {
  try {
    state.projects = JSON.parse(localStorage.getItem(K_PROJECTS) || '{}');
    state.activeProject = localStorage.getItem(K_ACTIVE);
    state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(K_SETTINGS) || '{}') };
  } catch (e) { console.warn('Load failed', e); }

  if (Object.keys(state.projects).length === 0) {
    const id = createProject('My First Project');
    state.activeProject = id;
  }
  if (!state.projects[state.activeProject]) {
    state.activeProject = Object.keys(state.projects)[0];
  }
}

function persist() {
  try {
    localStorage.setItem(K_PROJECTS, JSON.stringify(state.projects));
    localStorage.setItem(K_ACTIVE, state.activeProject);
    localStorage.setItem(K_SETTINGS, JSON.stringify(state.settings));
  } catch (e) { console.warn('Save failed', e); }
}

let saveTimer = null;
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
    name: name || 'Untitled',
    created: Date.now(),
    modified: Date.now(),
    files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
    activeFile: 'index.html'
  };
  persist();
  return id;
}

function currentProject() { return state.projects[state.activeProject]; }

/* ---------- UI Rendering ---------- */
function renderFileList() {
  const p = currentProject();
  const list = $('#fileList');
  list.innerHTML = '';
  if (!p) return;
  Object.keys(p.files).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
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
    tab.innerHTML = `<span>${name}</span>`;
    tab.addEventListener('click', () => openFile(name));
    bar.appendChild(tab);
  });
}

/* ---------- File operations ---------- */
function openFile(name) {
  try {
    const p = currentProject();
    if (!p || !p.files[name]) return;
    p.activeFile = name;
    const editor = $('#editor');
    editor.value = p.files[name].content;
    $('#projectName').textContent = p.name;
    $('#statusFile').textContent = name;
    updateHighlight();
    updateGutter();
    updateStatus();
    renderFileList();
    renderTabs();
    scheduleSave();
    schedulePreview();
    runDiagnostics();
  } catch (e) {
    console.error('openFile error:', e);
  }
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
      p.files[name] = { content: '' };
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
  showToast('Duplicated');
}

function deleteProject() {
  if (Object.keys(state.projects).length <= 1) { showToast('Cannot delete last project'); return; }
  if (!confirm(`Delete "${currentProject().name}"?`)) return;
  delete state.projects[state.activeProject];
  state.activeProject = Object.keys(state.projects)[0];
  persist();
  const p = currentProject();
  openFile(p.activeFile);
  renderProjectList();
}

/* ---------- Export/Import ---------- */
async function exportZip() {
  if (typeof JSZip === 'undefined') { showToast('JSZip not loaded'); return; }
  try {
    const p = currentProject();
    const zip = new JSZip();
    Object.entries(p.files).forEach(([name, f]) => zip.file(name, f.content));
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, p.name + '.zip');
    showToast('Exported');
  } catch (e) { showToast('Export failed'); }
}

async function importZip(file) {
  if (typeof JSZip === 'undefined') { showToast('JSZip not loaded'); return; }
  try {
    const zip = await JSZip.loadAsync(file);
    const files = {};
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const baseName = name.split('/').pop();
      if (!baseName) continue;
      files[baseName] = { content: await entry.async('string') };
    }
    if (Object.keys(files).length === 0) { showToast('No files'); return; }
    const name = file.name.replace(/\.zip$/i, '');
    const id = createProject(name);
    state.projects[id].files = files;
    state.projects[id].activeFile = files['index.html'] ? 'index.html' : Object.keys(files)[0];
    switchProject(id);
    showToast('Imported');
  } catch (e) { showToast('Import failed'); }
}

function downloadHtml() {
  const p = currentProject();
  const html = p.files['index.html']?.content || '';
  const css = p.files['style.css']?.content || '';
  const js = p.files['script.js']?.content || '';
  let out = html;
  out = out.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>\n${css}\n</style>`);
  out = out.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>\n${js}\n<\/script>`);
  downloadBlob(new Blob([out], { type: 'text/html' }), p.name + '.html');
  showToast('Downloaded');
}

async function shareProject() {
  const p = currentProject();
  const data = JSON.stringify({ name: p.name, files: p.files });
  try {
    await navigator.clipboard.writeText(data);
    showToast('Copied to clipboard');
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

function updateHighlight() {
  try {
    const p = currentProject();
    if (!p) return;
    const ext = p.activeFile.split('.').pop().toLowerCase();
    const lang = ext === 'html' ? 'html' : ext === 'css' ? 'css' : ext === 'js' ? 'js' : 'text';
    highlight.innerHTML = syntaxHighlight(editor.value, lang);
  } catch (e) {
    console.error('Highlight error:', e);
    highlight.textContent = editor.value;
  }
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

editor.addEventListener('scroll', () => {
  highlight.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
  gutter.scrollTop = editor.scrollTop;
});

editor.addEventListener('click', updateStatus);
editor.addEventListener('keyup', updateStatus);

/* ---------- Editor features ---------- */
editor.addEventListener('keydown', (e) => {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const val = editor.value;

  if (e.key === 'Tab') {
    e.preventDefault();
    const spaces = ' '.repeat(state.settings.tabSize);
    if (start === end) {
      insertText(spaces);
    } else {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const selected = val.slice(lineStart, end);
      const indented = selected.replace(/^/gm, spaces);
      editor.setSelectionRange(lineStart, end);
      insertText(indented);
    }
    return;
  }

  if (e.key === 'Enter') {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const currentLine = val.slice(lineStart, start);
    const indent = currentLine.match(/^\s*/)[0];
    insertText('\n' + indent);
    e.preventDefault();
    return;
  }

  const pairs = { '(':')', '[':']', '{':'}', '"':'"', "'":"'" };
  if (pairs[e.key] && start === end) {
    insertText(e.key + pairs[e.key]);
    editor.setSelectionRange(start + 1, start + 1);
    e.preventDefault();
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

/* ---------- Syntax Highlighter (Simplified) ---------- */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syntaxHighlight(code, lang) {
  if (lang === 'html') return highlightHtml(code);
  if (lang === 'css') return highlightCss(code);
  if (lang === 'js') return highlightJs(code);
  return escapeHtml(code);
}

function highlightHtml(code) {
  return code.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-com">$1</span>')
             .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g, '$1<span class="tok-tag">$2</span>')
             .replace(/([a-zA-Z-]+)=(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-attr">$1</span>=<span class="tok-str">$2</span>');
}

function highlightCss(code) {
  let result = escapeHtml(code);
  result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>');
  result = result.replace(/([a-zA-Z-]+)\s*:/g, '<span class="tok-prop">$1</span>:');
  result = result.replace(/([.#][a-zA-Z][\w-]*)\s*\{/g, '<span class="tok-sel">$1</span> {');
  return result;
}

function highlightJs(code) {
  let result = escapeHtml(code);
  result = result.replace(/(\/\/.*$)/gm, '<span class="tok-com">$1</span>');
  result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>');
  result = result.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tok-str">$1</span>');
  result = result.replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export)\b/g, '<span class="tok-kw">$1</span>');
  result = result.replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
  return result;
}

/* ---------- Live Preview ---------- */
const preview = $('#preview');
let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 350);
}
function updatePreview() {
  try {
    const p = currentProject();
    if (!p) return;
    const html = p.files['index.html']?.content || '';
    const css = p.files['style.css']?.content || '';
    const js = p.files['script.js']?.content || '';
    let doc = html;
    doc = doc.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>\n${css}\n</style>`);
    doc = doc.replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>\n${js}\n<\/script>`);
    preview.srcdoc = doc;
  } catch (e) {
    console.error('Preview error:', e);
  }
}

$('#btnRefresh').addEventListener('click', updatePreview);
$('#btnRun').addEventListener('click', updatePreview);
$('#btnPreviewFull').addEventListener('click', () => {
  document.body.classList.toggle('preview-full');
});
$('#btnNewTab').addEventListener('click', () => {
  const p = currentProject();
  const html = p.files['index.html']?.content || '';
  const blob = new Blob([html], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
});

/* ---------- Diagnostics ---------- */
let diagTimer;
function runDiagnostics() {
  clearTimeout(diagTimer);
  diagTimer = setTimeout(_runDiagnostics, 300);
}
function _runDiagnostics() {
  try {
    const p = currentProject();
    if (!p) return;
    const errors = [];
    if (p.files['script.js']) {
      const jsErr = checkJsSyntax(p.files['script.js'].content);
      if (jsErr) errors.push({ file: 'script.js', ...jsErr });
    }
    renderErrors(errors);
  } catch (e) {
    console.error('Diagnostics error:', e);
  }
}

function checkJsSyntax(code) {
  try {
    new Function(code);
    return null;
  } catch (e) {
    return { line: 1, msg: e.message };
  }
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
}

$('#btnCloseErrors').addEventListener('click', () => $('#errorPanel').style.display = 'none');

/* ---------- Find/Replace ---------- */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    $('#findbar').style.display = 'flex';
    $('#findInput').focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    persist();
    showToast('Saved');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    updatePreview();
  }
});

$('#btnCloseFind').addEventListener('click', () => $('#findbar').style.display = 'none');
$('#btnFindNext').addEventListener('click', () => {
  const q = $('#findInput').value;
  if (!q) return;
  const idx = editor.value.indexOf(q, editor.selectionEnd);
  if (idx !== -1) {
    editor.focus();
    editor.setSelectionRange(idx, idx + q.length);
  }
});
$('#btnReplace').addEventListener('click', () => {
  const q = $('#findInput').value;
  const r = $('#replaceInput').value;
  if (editor.value.slice(editor.selectionStart, editor.selectionEnd) === q) {
    insertText(r);
  }
});
$('#btnReplaceAll').addEventListener('click', () => {
  const q = $('#findInput').value;
  const r = $('#replaceInput').value;
  editor.value = editor.value.split(q).join(r);
  editor.dispatchEvent(new Event('input'));
});

/* ---------- Split handle ---------- */
const splitHandle = $('#splitHandle');
const editorPane = $('#editorPane');
let dragging = false;
splitHandle.addEventListener('mousedown', () => { dragging = true; });
document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const rect = $('#split').getBoundingClientRect();
  const pct = ((e.clientX - rect.left) / rect.width) * 100;
  editorPane.style.flex = `0 0 ${Math.max(20, Math.min(80, pct))}%`;
});
document.addEventListener('mouseup', () => { dragging = false; });

/* ---------- Sidebar ---------- */
$('#btnSidebar').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

$$('.stab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.stab').forEach(b => b.classList.toggle('active', b === btn));
    $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.panel));
  });
});

/* ---------- Theme ---------- */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  state.settings.theme = t;
  persist();
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
    <label>Auto save <input type="checkbox" id="setAutoSave" ${s.autoSave?'checked':''} /></label>
  `, [
    { label: 'Cancel', action: closeModal },
    { label: 'Save', primary: true, action: () => {
      state.settings.fontSize = parseInt($('#setFontSize').value) || 14;
      state.settings.tabSize = parseInt($('#setTabSize').value) || 2;
      state.settings.autoSave = $('#setAutoSave').checked;
      document.documentElement.style.setProperty('--editor-font-size', state.settings.fontSize + 'px');
      document.documentElement.style.setProperty('--tab-size', state.settings.tabSize);
      persist();
      closeModal();
    }}
  ]);
});

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

/* ---------- Tools ---------- */
const toolHandlers = {
  json: {
    title: 'JSON Formatter',
    render: () => `<textarea id="tJson" placeholder='{"hello":"world"}'></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="format">Format</button>
        <button class="mini-btn" data-do="minify">Minify</button>
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
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#tJsonOut').textContent);
    }
  },
  base64: {
    title: 'Base64',
    render: () => `<textarea id="tB64" placeholder="Text…"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="enc">Encode</button>
        <button class="mini-btn" data-do="dec">Decode</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>
      <div class="tool-output" id="tB64Out">—</div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="enc"]').onclick = () => {
        try { $('#tB64Out').textContent = btoa($('#tB64').value); }
        catch(e) { $('#tB64Out').textContent = '✗ ' + e.message; }
      };
      $('#toolBody').querySelector('[data-do="dec"]').onclick = () => {
        try { $('#tB64Out').textContent = atob($('#tB64').value.trim()); }
        catch { $('#tB64Out').textContent = '✗ Invalid'; }
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#tB64Out').textContent);
    }
  },
  password: {
    title: 'Password',
    render: () => `<div class="tool-field"><label>Length: <span id="pLenV">16</span></label>
        <input type="range" id="pLen" min="4" max="64" value="16" /></div>
      <div class="tool-output" id="pOut">—</div>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      $('#pLen').oninput = e => $('#pLenV').textContent = e.target.value;
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        const len = parseInt($('#pLen').value);
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        $('#pOut').textContent = Array.from(arr, n => c[n % c.length]).join('');
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#pOut').textContent);
    }
  },
  uuid: {
    title: 'UUID',
    render: () => `<div class="tool-output" id="uOut">—</div>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        $('#uOut').textContent = crypto.randomUUID();
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#uOut').textContent);
    }
  },
  color: {
    title: 'Color Picker',
    render: () => `<input type="color" id="cPick" value="#6366f1" style="width:100%;height:60px" />
      <div class="tool-field"><label>HEX</label><input type="text" id="cHex" value="#6366F1" /></div>
      <div class="tool-field"><label>RGB</label><input type="text" id="cRgb" readonly /></div>`,
    bind: () => {
      const upd = (hex) => {
        hex = hex.replace('#','');
        const n = parseInt(hex,16);
        const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
        $('#cHex').value = '#' + hex.toUpperCase();
        $('#cRgb').value = `rgb(${r}, ${g}, ${b})`;
      };
      $('#cPick').oninput = e => upd(e.target.value);
      upd('#6366f1');
    }
  },
  counter: {
    title: 'Word Counter',
    render: () => `<textarea id="tCnt" placeholder="Type text…"></textarea>
      <div class="tool-output" id="tCntOut">—</div>`,
    bind: () => {
      $('#tCnt').oninput = () => {
        const t = $('#tCnt').value;
        $('#tCntOut').textContent = `Characters: ${t.length}\nWords: ${t.trim() ? t.trim().split(/\s+/).length : 0}\nLines: ${t ? t.split('\n').length : 0}`;
      };
    }
  },
  lorem: {
    title: 'Lorem Ipsum',
    render: () => `<textarea id="lOut" readonly style="min-height:180px"></textarea>
      <div class="tool-row">
        <button class="mini-btn" data-do="gen">Generate</button>
        <button class="mini-btn" data-do="copy">Copy</button>
      </div>`,
    bind: () => {
      const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor".split(' ');
      $('#toolBody').querySelector('[data-do="gen"]').onclick = () => {
        const w = Array.from({length:50}, () => words[Math.floor(Math.random()*words.length)]);
        $('#lOut').value = w.join(' ') + '.';
      };
      $('#toolBody').querySelector('[data-do="copy"]').onclick = () => copyText($('#lOut').value);
    }
  },
  qr: {
    title: 'QR Code',
    render: () => `<textarea id="qIn" placeholder="Text or URL…"></textarea>
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

/* ---------- Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('SW failed:', err);
    });
  });
}

/* ---------- Init ---------- */
function init() {
  try {
    loadState();
    applyTheme(state.settings.theme);
    document.documentElement.style.setProperty('--editor-font-size', state.settings.fontSize + 'px');
    document.documentElement.style.setProperty('--tab-size', state.settings.tabSize);
    renderProjectList();
    renderFileList();
    const p = currentProject();
    if (p) openFile(p.activeFile);
    updatePreview();
  } catch (e) {
    console.error('Init error:', e);
  }
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
