/* =========================================================
   DevStudio Mobile — Secure Code Editor
   ========================================================= */

// Storage keys
const K_PROJECTS = 'devstudio_mobile_projects';
const K_ACTIVE = 'devstudio_mobile_active';
const K_SETTINGS = 'devstudio_mobile_settings';
const K_PIN = 'devstudio_mobile_pin';
const K_LOCK_TIME = 'devstudio_mobile_lock_time';

// Default files
const DEFAULT_FILES = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, Mobile!</h1>
  <p>Edit code and see live preview.</p>
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
  padding: 20px;
}
h1 { font-size: 2rem; margin-bottom: 1rem; }`,
  'script.js': `console.log("App ready!");
document.querySelector("h1").addEventListener("click", () => {
  alert("It works!");
});`
};

// State
let state = {
  projects: {},
  activeProject: null,
  settings: {
    theme: 'dark',
    fontSize: 14,
    autoSave: true,
    autoLock: 5
  },
  pin: '1234',
  pinInput: '',
  lockTimer: null
};

// DOM helpers
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Toast
function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// Modal
function showModal(title, bodyHtml, onOk) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  $('#modal').classList.add('show');
  $('#modalOk').onclick = () => {
    if (onOk) onOk();
    $('#modal').classList.remove('show');
  };
}
$('#modalCancel').onclick = () => $('#modal').classList.remove('show');

// Load state
function loadState() {
  try {
    state.projects = JSON.parse(localStorage.getItem(K_PROJECTS) || '{}');
    state.activeProject = localStorage.getItem(K_ACTIVE);
    state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(K_SETTINGS) || '{}') };
    state.pin = localStorage.getItem(K_PIN) || '1234';
  } catch (e) {
    console.error('Load failed:', e);
  }

  if (Object.keys(state.projects).length === 0) {
    const id = createProject('My Project');
    state.activeProject = id;
  }
  if (!state.projects[state.activeProject]) {
    state.activeProject = Object.keys(state.projects)[0];
  }
}

// Save state
function persist() {
  try {
    localStorage.setItem(K_PROJECTS, JSON.stringify(state.projects));
    localStorage.setItem(K_ACTIVE, state.activeProject);
    localStorage.setItem(K_SETTINGS, JSON.stringify(state.settings));
    localStorage.setItem(K_PIN, state.pin);
  } catch (e) {
    console.error('Save failed:', e);
  }
}

// Auto save
let saveTimer = null;
function scheduleSave() {
  if (!state.settings.autoSave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 500);
}

// Create project
function createProject(name) {
  const id = 'p_' + Date.now();
  state.projects[id] = {
    id,
    name: name || 'Untitled',
    created: Date.now(),
    files: JSON.parse(JSON.stringify(DEFAULT_FILES)),
    activeFile: 'index.html'
  };
  persist();
  return id;
}

function currentProject() {
  return state.projects[state.activeProject];
}

// PIN Lock
function checkPin() {
  const lastLock = parseInt(localStorage.getItem(K_LOCK_TIME) || '0');
  const now = Date.now();
  const minutesPassed = (now - lastLock) / 60000;
  
  if (minutesPassed < state.settings.autoLock) {
    unlock();
  }
}

function unlock() {
  $('#lockScreen').style.display = 'none';
  $('#app').style.display = 'flex';
  resetLockTimer();
}

function lock() {
  $('#lockScreen').style.display = 'flex';
  $('#app').style.display = 'none';
  state.pinInput = '';
  updatePinDisplay();
  localStorage.setItem(K_LOCK_TIME, Date.now().toString());
}

function resetLockTimer() {
  clearTimeout(state.lockTimer);
  state.lockTimer = setTimeout(lock, state.settings.autoLock * 60000);
}

// PIN pad
$$('.pin-btn[data-num]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.pinInput.length < 4) {
      state.pinInput += btn.dataset.num;
      updatePinDisplay();
      if (state.pinInput.length === 4) {
        setTimeout(checkPinInput, 200);
      }
    }
  });
});

$('#pinClear').addEventListener('click', () => {
  state.pinInput = state.pinInput.slice(0, -1);
  updatePinDisplay();
});

$('#pinEnter').addEventListener('click', checkPinInput);

function updatePinDisplay() {
  $$('.pin-dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < state.pinInput.length);
  });
}

function checkPinInput() {
  if (state.pinInput === state.pin) {
    unlock();
    showToast('Unlocked ✓');
  } else {
    showToast('Wrong PIN');
    state.pinInput = '';
    updatePinDisplay();
  }
}

$('#btnLockNow').addEventListener('click', lock);

// Navigation
$$('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#${btn.dataset.view}`).classList.add('active');
    
    if (btn.dataset.view === 'previewView') {
      updatePreview();
    }
  });
});

// Side menu
$('#btnMenu').addEventListener('click', () => {
  $('#sideMenu').classList.add('open');
  $('#overlay').classList.add('show');
});

$('#btnCloseMenu').addEventListener('click', closeMenu);
$('#overlay').addEventListener('click', closeMenu);

function closeMenu() {
  $('#sideMenu').classList.remove('open');
  $('#overlay').classList.remove('show');
}

// File operations
$('#menuNewFile').addEventListener('click', () => {
  closeMenu();
  showModal('New File', '<input type="text" id="newFileName" placeholder="filename.js" />', () => {
    const name = $('#newFileName').value.trim();
    if (!name) return;
    const p = currentProject();
    if (p.files[name]) {
      showToast('File exists');
      return;
    }
    p.files[name] = { content: '' };
    openFile(name);
    renderFileTabs();
    renderFilesList();
    showToast('Created');
  });
});

$('#menuRename').addEventListener('click', () => {
  closeMenu();
  const p = currentProject();
  showModal('Rename', `<input type="text" id="renameInput" value="${p.activeFile}" />`, () => {
    const newName = $('#renameInput').value.trim();
    if (!newName || newName === p.activeFile) return;
    if (p.files[newName]) {
      showToast('File exists');
      return;
    }
    p.files[newName] = p.files[p.activeFile];
    delete p.files[p.activeFile];
    p.activeFile = newName;
    openFile(newName);
    renderFileTabs();
    renderFilesList();
    showToast('Renamed');
  });
});

$('#menuDelete').addEventListener('click', () => {
  closeMenu();
  const p = currentProject();
  if (Object.keys(p.files).length <= 1) {
    showToast('Cannot delete last file');
    return;
  }
  if (!confirm(`Delete ${p.activeFile}?`)) return;
  delete p.files[p.activeFile];
  p.activeFile = Object.keys(p.files)[0];
  openFile(p.activeFile);
  renderFileTabs();
  renderFilesList();
  showToast('Deleted');
});

$('#menuDownload').addEventListener('click', () => {
  closeMenu();
  const p = currentProject();
  const html = p.files['index.html']?.content || '';
  const css = p.files['style.css']?.content || '';
  const js = p.files['script.js']?.content || '';
  let out = html
    .replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>\n${css}\n</style>`)
    .replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>\n${js}\n<\/script>`);
  downloadFile(out, p.name + '.html', 'text/html');
  showToast('Downloaded');
});

$('#menuShare').addEventListener('click', async () => {
  closeMenu();
  const p = currentProject();
  const data = JSON.stringify({ name: p.name, files: p.files });
  try {
    await navigator.clipboard.writeText(data);
    showToast('Copied to clipboard');
  } catch {
    showToast('Share failed');
  }
});

// Export/Import
$('#btnExport').addEventListener('click', async () => {
  if (typeof JSZip === 'undefined') {
    showToast('JSZip not loaded');
    return;
  }
  const p = currentProject();
  const zip = new JSZip();
  Object.entries(p.files).forEach(([name, f]) => zip.file(name, f.content));
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, p.name + '.zip');
  showToast('Exported');
});

$('#btnImport').addEventListener('click', () => $('#zipInput').click());
$('#zipInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (typeof JSZip === 'undefined') {
    showToast('JSZip not loaded');
    return;
  }
  try {
    const zip = await JSZip.loadAsync(file);
    const files = {};
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const baseName = name.split('/').pop();
      if (!baseName) continue;
      files[baseName] = { content: await entry.async('string') };
    }
    const name = file.name.replace(/\.zip$/i, '');
    const id = createProject(name);
    state.projects[id].files = files;
    state.projects[id].activeFile = files['index.html'] ? 'index.html' : Object.keys(files)[0];
    switchProject(id);
    showToast('Imported');
  } catch (e) {
    showToast('Import failed');
  }
  e.target.value = '';
});

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Editor
const editor = $('#editor');
const highlight = $('#highlight');
const lineNumbers = $('#lineNumbers');
const errorMarker = $('#errorMarker');

function openFile(name) {
  const p = currentProject();
  if (!p || !p.files[name]) return;
  p.activeFile = name;
  editor.value = p.files[name].content;
  $('#fileName').textContent = name;
  $('#projectName').textContent = p.name;
  updateHighlight();
  updateLineNumbers();
  runDiagnostics();
  renderFileTabs();
  renderFilesList();
  scheduleSave();
}

editor.addEventListener('input', () => {
  const p = currentProject();
  if (!p) return;
  p.files[p.activeFile].content = editor.value;
  updateHighlight();
  updateLineNumbers();
  runDiagnostics();
  scheduleSave();
});

editor.addEventListener('scroll', () => {
  highlight.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
  lineNumbers.scrollTop = editor.scrollTop;
});

// Auto-indent, auto-close
editor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
    editor.dispatchEvent(new Event('input'));
  }
  
  if (e.key === 'Enter') {
    const start = editor.selectionStart;
    const val = editor.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const currentLine = val.slice(lineStart, start);
    const indent = currentLine.match(/^\s*/)[0];
    e.preventDefault();
    editor.value = val.slice(0, start) + '\n' + indent + val.slice(start);
    editor.selectionStart = editor.selectionEnd = start + 1 + indent.length;
    editor.dispatchEvent(new Event('input'));
  }
  
  const pairs = { '(': ')', '[': ']', '{': '}' };
  if (pairs[e.key]) {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.slice(0, start) + e.key + pairs[e.key] + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + 1;
    editor.dispatchEvent(new Event('input'));
  }
});

// Syntax highlighting
function updateHighlight() {
  const p = currentProject();
  if (!p) return;
  const ext = p.activeFile.split('.').pop().toLowerCase();
  const code = editor.value;
  
  if (ext === 'html') {
    highlight.innerHTML = highlightHtml(code);
  } else if (ext === 'css') {
    highlight.innerHTML = highlightCss(code);
  } else if (ext === 'js') {
    highlight.innerHTML = highlightJs(code);
  } else {
    highlight.textContent = code;
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightHtml(code) {
  return escapeHtml(code)
    .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g, '$1<span class="tok-tag">$2</span>')
    .replace(/([a-zA-Z-]+)=(&quot;[^&]*?&quot;)/g, '<span class="tok-attr">$1</span>=$2');
}

function highlightCss(code) {
  return escapeHtml(code)
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-com">$1</span>')
    .replace(/([a-zA-Z-]+)\s*:/g, '<span class="tok-prop">$1</span>:');
}

function highlightJs(code) {
  return escapeHtml(code)
    .replace(/(\/\/.*$)/gm, '<span class="tok-com">$1</span>')
    .replace(/(&quot;[^&]*?&quot;)/g, '<span class="tok-str">$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while)\b/g, '<span class="tok-kw">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>');
}

// Line numbers
function updateLineNumbers() {
  const lines = editor.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) {
    html += i + '\n';
  }
  lineNumbers.textContent = html;
}

// Diagnostics
let diagTimer;
function runDiagnostics() {
  clearTimeout(diagTimer);
  diagTimer = setTimeout(_runDiagnostics, 300);
}

function _runDiagnostics() {
  const p = currentProject();
  if (!p) return;
  
  const errors = [];
  
  // Check JS
  if (p.files['script.js']) {
    const jsErr = checkJsSyntax(p.files['script.js'].content);
    if (jsErr) errors.push({ file: 'script.js', ...jsErr });
  }
  
  // Check CSS
  if (p.files['style.css']) {
    const cssErr = checkCssSyntax(p.files['style.css'].content);
    if (cssErr) errors.push({ file: 'style.css', ...cssErr });
  }
  
  // Check HTML
  if (p.files['index.html']) {
    const htmlErr = checkHtmlSyntax(p.files['index.html'].content);
    if (htmlErr) errors.push({ file: 'index.html', ...htmlErr });
  }
  
  showErrors(errors);
}

function checkJsSyntax(code) {
  try {
    new Function(code);
    return null;
  } catch (e) {
    const match = e.message.match(/line (\d+)/i);
    const line = match ? parseInt(match[1]) : 1;
    return { line, msg: e.message };
  }
}

function checkCssSyntax(code) {
  let depth = 0;
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth < 0) {
        return { line: i + 1, msg: "Unexpected '}'" };
      }
    }
  }
  if (depth > 0) {
    return { line: lines.length, msg: `Missing ${depth} closing '}'` };
  }
  return null;
}

function checkHtmlSyntax(code) {
  const stack = [];
  const voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*?>/g;
  let m;
  while ((m = tagRe.exec(code)) !== null) {
    const full = m[0];
    const name = m[1];
    if (voidTags.test(name)) continue;
    if (full.startsWith('</')) {
      if (stack.length && stack[stack.length - 1].name === name) {
        stack.pop();
      }
    } else if (!full.endsWith('/>')) {
      stack.push({ name, pos: m.index });
    }
  }
  if (stack.length > 0) {
    const line = code.slice(0, stack[0].pos).split('\n').length;
    return { line, msg: `Unclosed <${stack[0].name}>` };
  }
  return null;
}

function showErrors(errors) {
  const errorBar = $('#errorBar');
  const errorText = $('#errorText');
  
  if (errors.length === 0) {
    errorBar.style.display = 'none';
    errorMarker.style.display = 'none';
    return;
  }
  
  const p = currentProject();
  const currentError = errors.find(e => e.file === p.activeFile);
  
  if (currentError) {
    errorBar.style.display = 'flex';
    errorText.textContent = `${currentError.file}: Line ${currentError.line} - ${currentError.msg}`;
    
    // Highlight error line
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 22;
    errorMarker.style.display = 'block';
    errorMarker.style.top = (12 + (currentError.line - 1) * lineHeight - editor.scrollTop) + 'px';
  } else {
    errorBar.style.display = 'none';
    errorMarker.style.display = 'none';
  }
}

$('#errorClose').addEventListener('click', () => {
  $('#errorBar').style.display = 'none';
  errorMarker.style.display = 'none';
});

// Preview
function updatePreview() {
  const p = currentProject();
  if (!p) return;
  
  const html = p.files['index.html']?.content || '';
  const css = p.files['style.css']?.content || '';
  const js = p.files['script.js']?.content || '';
  
  let doc = html
    .replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>\n${css}\n</style>`)
    .replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>\n${js}\n<\/script>`);
  
  $('#previewFrame').srcdoc = doc;
}

$('#btnRun').addEventListener('click', () => {
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  $$('[data-view="previewView"]').forEach(b => b.classList.add('active'));
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#previewView').classList.add('active');
  updatePreview();
});

// File tabs
function renderFileTabs() {
  const p = currentProject();
  const tabs = $('#fileTabs');
  tabs.innerHTML = '';
  if (!p) return;
  
  Object.keys(p.files).forEach(name => {
    const tab = document.createElement('div');
    tab.className = 'file-tab' + (name === p.activeFile ? ' active' : '');
    tab.textContent = name;
    tab.addEventListener('click', () => openFile(name));
    tabs.appendChild(tab);
  });
}

// Files list
function renderFilesList() {
  const p = currentProject();
  const list = $('#filesList');
  list.innerHTML = '';
  if (!p) return;
  
  Object.keys(p.files).forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    if (name === p.activeFile) li.classList.add('active');
    li.addEventListener('click', () => {
      openFile(name);
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      $$('[data-view="editorView"]').forEach(b => b.classList.add('active'));
      $$('.view').forEach(v => v.classList.remove('active'));
      $('#editorView').classList.add('active');
    });
    list.appendChild(li);
  });
}

// Projects
function renderProjectsList() {
  const list = $('#projectsList');
  list.innerHTML = '';
  
  Object.values(state.projects).forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (p.id === state.activeProject) li.classList.add('active');
    li.addEventListener('click', () => {
      switchProject(p.id);
    });
    list.appendChild(li);
  });
}

function switchProject(id) {
  state.activeProject = id;
  persist();
  const p = currentProject();
  openFile(p.activeFile);
  renderProjectsList();
  showToast('Switched');
}

$('#btnNewProject').addEventListener('click', () => {
  showModal('New Project', '<input type="text" id="newProjName" placeholder="Project name" />', () => {
    const name = $('#newProjName').value.trim() || 'Untitled';
    const id = createProject(name);
    switchProject(id);
    renderProjectsList();
  });
});

// Settings
$('#settingTheme').addEventListener('change', (e) => {
  state.settings.theme = e.target.value;
  document.documentElement.setAttribute('data-theme', e.target.value);
  persist();
});

$('#settingFontSize').addEventListener('input', (e) => {
  state.settings.fontSize = parseInt(e.target.value);
  document.documentElement.style.setProperty('--editor-font-size', e.target.value + 'px');
  persist();
});

$('#settingAutoSave').addEventListener('change', (e) => {
  state.settings.autoSave = e.target.checked;
  persist();
});

$('#settingAutoLock').addEventListener('change', (e) => {
  state.settings.autoLock = parseInt(e.target.value) || 5;
  persist();
  resetLockTimer();
});

$('#btnChangePin').addEventListener('click', () => {
  showModal('Change PIN', '<input type="password" id="newPin" placeholder="New 4-digit PIN" maxlength="4" />', () => {
    const newPin = $('#newPin').value;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast('PIN must be 4 digits');
      return;
    }
    state.pin = newPin;
    persist();
    showToast('PIN changed');
  });
});

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.warn('SW failed:', err);
    });
  });
}

// Init
function init() {
  loadState();
  document.documentElement.setAttribute('data-theme', state.settings.theme);
  document.documentElement.style.setProperty('--editor-font-size', state.settings.fontSize + 'px');
  $('#settingTheme').value = state.settings.theme;
  $('#settingFontSize').value = state.settings.fontSize;
  $('#settingAutoSave').checked = state.settings.autoSave;
  $('#settingAutoLock').value = state.settings.autoLock;
  
  renderProjectsList();
  const p = currentProject();
  if (p) openFile(p.activeFile);
  
  checkPin();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
