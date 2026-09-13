(function () {
  'use strict';

  /* ---------- helpers ---------- */

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CH = { ENTER: 13, SPACE: 32, TAB: 9, ESC: 27, BACKSPACE: 8, DEL: 46, INS: 45,
    HOME: 36, END: 35, PGUP: 33, PGDN: 34, ARROWUP: 38, ARROWDOWN: 40, ARROWLEFT: 37, ARROWRIGHT: 39,
    SEMI: 186, QUOTE: 222, EQUAL: 187, MINUS: 189, BRACKET_OPEN: 219, BRACKET_CLOSE: 221, SLASH: 191 };
  const cc = (c) => String(c).toUpperCase().charCodeAt(0);
  const KEY_CODES = {
    Enter: CH.ENTER, ' ': CH.SPACE, '\t': 9, Escape: CH.ESC, Backspace: CH.BACKSPACE,
    Delete: CH.DEL, Insert: CH.INS, Home: CH.HOME, End: CH.END, PageUp: CH.PGUP, PageDown: CH.PGDN,
    ArrowUp: CH.ARROWUP, ArrowDown: CH.ARROWDOWN, ArrowLeft: CH.ARROWLEFT, ArrowRight: CH.ARROWRIGHT,
    Control: 17, Alt: 18, Shift: 16,
  };
  function keyOf(k, c, mods) {
    let code = KEY_CODES[k] !== undefined ? KEY_CODES[k] : (k.length === 1 ? cc(k) : 0);
    return { type: 'key', key: k, code: c, keyCode: code, mods: mods || {} };
  }
  const wheelOf = (motion, mods) => ({ type: 'wheel', motion: motion, mods: mods || {} });

  function modsLabel(d) {
    const out = [];
    if (d.ctrl) out.push('Ctrl');
    if (d.alt) out.push('Alt');
    if (d.shift) out.push('Shift');
    return out;
  }
  function comboText(d, forShortcut) {
    if (d.type === 'key') {
      const k = d.key || d.code || '?';
      return modsLabel(d.mods || {}).concat([k]).join(' + ') || '?';
    }
    if (d.type === 'mouse') {
      const M = { 0: 'Left Click', 1: 'Middle Click', 2: 'Right Click', 3: 'Back Button', 4: 'Forward Button' };
      return M[d.button] || 'Mouse ' + d.button;
    }
    if (d.type === 'wheel') {
      const W = { up: 'Scroll Up', down: 'Scroll Down', left: 'Scroll Left', right: 'Scroll Right' };
      const m = (d.mods && modsLabel(d.mods).join(' + '));
      const base = W[d.motion] || d.motion;
      return m ? m + ' + ' + base : base;
    }
    return '?';
  }
  function labelOf(d, empty) {
    if (!d) return empty || '<span class="mod">record…</span>';
    return comboText(d).split(' + ').map((s, i) => '<span class="mod">' + esc(s) + '</span>').join(' + ');
  }

  /* ---------- browser shortcuts that must be blocked ---------- */

  function isBrowserShortcut(d) {
    if (!d || d.type !== 'key') return false;
    const k = ((d.key || '') + '').toUpperCase();
    const m = d.mods || {};
    const ctrl = !!m.ctrl, alt = !!m.alt, shift = !!m.shift;
    const plain = !ctrl && !alt && !shift;
    const vk = k.replace('+', 'PLUS').replace('-', 'MINUS').replace(' ', 'SPACE');

    if (plain) return ['F1', 'F3', 'F5', 'F6', 'F7', 'F11', 'F12'].includes(k);
    if (ctrl && !alt && !shift) return [
      'F', 'L', 'H', 'D', 'P', 'J', 'K', 'E', 'B', 'O', 'T', 'W', 'N', 'Q', 'R',
      'PLUS', 'MINUS', '0',
    ].includes(vk);
    if (ctrl && shift && !alt) return [
      'T', 'N', 'W', 'Q', 'P', 'I', 'J', 'C', 'B', 'R', 'E', 'DEL', 'DELETE',
    ].includes(vk);
    if (alt && !ctrl) return ['ARROWLEFT', 'ARROWRIGHT', 'D', 'HOME'].includes(vk);
    return false;
  }

  /* ---------- Photopea default actions ---------- */

  const MK = (mods) => Object.assign({ ctrl: false, alt: false, shift: false }, mods);
  const K = (key, code, mods) => keyOf(key, code, MK(mods));

  const PRESETS = [
    { name: 'Open', shortcut: 'Ctrl+O', t: K('o', 'KeyO', { ctrl: true }) },
    { name: 'Save', shortcut: 'Ctrl+S', t: K('s', 'KeyS', { ctrl: true }) },
    { name: 'Save as PSD', shortcut: 'Ctrl+Shift+S', t: K('s', 'KeyS', { ctrl: true, shift: true }) },
    { name: 'Export as', shortcut: 'Ctrl+Shift+Alt+S', t: K('s', 'KeyS', { ctrl: true, shift: true, alt: true }) },
    { name: 'Step Forward', shortcut: 'Ctrl+Shift+Z', t: K('z', 'KeyZ', { ctrl: true, shift: true }) },
    { name: 'Step Backward', shortcut: 'Ctrl+Alt+Z', t: K('z', 'KeyZ', { ctrl: true, alt: true }) },
    { name: 'Copy', shortcut: 'Ctrl+C', t: K('c', 'KeyC', { ctrl: true }) },
    { name: 'Paste', shortcut: 'Ctrl+V', t: K('v', 'KeyV', { ctrl: true }) },
    { name: 'Clear', shortcut: 'Delete', t: K('Delete', 'Delete') },
    { name: 'Fill', shortcut: 'Alt+Backspace', t: K('Backspace', 'Backspace', { alt: true }) },
    { name: 'Free Transform', shortcut: 'Ctrl+Alt+T', t: K('t', 'KeyT', { ctrl: true, alt: true }) },
    { name: 'Preferences', shortcut: 'Ctrl+K', t: K('k', 'KeyK', { ctrl: true }) },
    { name: 'Levels', shortcut: 'Ctrl+L', t: K('l', 'KeyL', { ctrl: true }) },
    { name: 'Curves', shortcut: 'Ctrl+M', t: K('m', 'KeyM', { ctrl: true }) },
    { name: 'Hue/Saturation', shortcut: 'Ctrl+U', t: K('u', 'KeyU', { ctrl: true }) },
    { name: 'Invert', shortcut: 'Ctrl+I', t: K('i', 'KeyI', { ctrl: true }) },
    { name: 'New Layer', shortcut: 'Ctrl+Shift+N', t: K('n', 'KeyN', { ctrl: true, shift: true }) },
    { name: 'Layer Via Copy', shortcut: 'Ctrl+J', t: K('j', 'KeyJ', { ctrl: true }) },
    { name: 'Clipping Mask', shortcut: 'Ctrl+Alt+G', t: K('g', 'KeyG', { ctrl: true, alt: true }) },
    { name: 'Group Layers', shortcut: 'Ctrl+G', t: K('g', 'KeyG', { ctrl: true }) },
    { name: 'Merge Down', shortcut: 'Ctrl+E', t: K('e', 'KeyE', { ctrl: true }) },
    { name: 'Select All', shortcut: 'Ctrl+A', t: K('a', 'KeyA', { ctrl: true }) },
    { name: 'Deselect', shortcut: 'Ctrl+D', t: K('d', 'KeyD', { ctrl: true }) },
    { name: 'Inverse', shortcut: 'Ctrl+Shift+I', t: K('i', 'KeyI', { ctrl: true, shift: true }) },
    { name: 'Zoom In', shortcut: 'Ctrl+Plus', t: K('=', 'Equal', { ctrl: true }) },
    { name: 'Zoom Out', shortcut: 'Ctrl+Minus', t: K('-', 'Minus', { ctrl: true }) },
    { name: 'Rulers', shortcut: 'Ctrl+R', t: K('r', 'KeyR', { ctrl: true }) },
    { name: 'Guides', shortcut: 'Ctrl+;', t: K(';', 'Semicolon', { ctrl: true }) },
    { name: 'Grid', shortcut: "Ctrl+'", t: K("'", 'Quote', { ctrl: true }) },
    { name: 'Keyboard Shortcuts', shortcut: 'Ctrl+?', t: K('?', 'Slash', { ctrl: true, shift: true }) },
    { name: 'Vertical Scroll', shortcut: 'Mouse Wheel', t: wheelOf('down') },
    { name: 'Horizontal Scroll', shortcut: 'Ctrl+Wheel', t: wheelOf('right', { ctrl: true }) },
    { name: 'Zooming', shortcut: 'Alt+Wheel', t: wheelOf('up', { alt: true }) },
    { name: 'Temporary Move Tool', shortcut: 'Ctrl (hold)', t: K('Control', 'ControlLeft', { ctrl: true }) },
    { name: 'Temporary Hand Tool', shortcut: 'Space (hold)', t: K(' ', 'Space') },
    { name: 'Temporary Zoom Tool', shortcut: 'Ctrl+Space (hold)', t: K(' ', 'Space', { ctrl: true }) },
    { name: 'Move / Artboard Tool', shortcut: 'V', t: K('v', 'KeyV') },
    { name: 'Rect / Ellipse Select', shortcut: 'M', t: K('m', 'KeyM') },
    { name: 'Lasso Select', shortcut: 'L', t: K('l', 'KeyL') },
    { name: 'Magic Wand / Quick Sel', shortcut: 'W', t: K('w', 'KeyW') },
    { name: 'Crop / Slice Tool', shortcut: 'C', t: K('c', 'KeyC') },
    { name: 'Eyedropper / Ruler', shortcut: 'I', t: K('i', 'KeyI') },
    { name: 'Healing Brush', shortcut: 'J', t: K('j', 'KeyJ') },
    { name: 'Brush / Pencil', shortcut: 'B', t: K('b', 'KeyB') },
    { name: 'Clone Tool', shortcut: 'S', t: K('s', 'KeyS') },
    { name: 'Eraser', shortcut: 'E', t: K('e', 'KeyE') },
    { name: 'Gradient / Paint Bucket', shortcut: 'G', t: K('g', 'KeyG') },
    { name: 'Dodge / Burn / Sponge', shortcut: 'O', t: K('o', 'KeyO') },
    { name: 'Type Tool', shortcut: 'T', t: K('t', 'KeyT') },
    { name: 'Pen Tool', shortcut: 'P', t: K('p', 'KeyP') },
    { name: 'Path / Direct Select', shortcut: 'A', t: K('a', 'KeyA') },
    { name: 'Rectangle / Shape Tool', shortcut: 'U', t: K('u', 'KeyU') },
    { name: 'Hand Tool', shortcut: 'H', t: K('h', 'KeyH') },
    { name: 'Zoom Tool', shortcut: 'Z', t: K('z', 'KeyZ') },
    { name: 'Default White/Black', shortcut: 'D', t: K('d', 'KeyD') },
    { name: 'Swap Colors', shortcut: 'X', t: K('x', 'KeyX') },
    { name: 'Quick Mask Mode', shortcut: 'Q', t: K('q', 'KeyQ') },
    { name: 'Decrease Brush Size', shortcut: '[', t: K('[', 'BracketLeft') },
    { name: 'Increase Brush Size', shortcut: ']', t: K(']', 'BracketRight') },
    { name: 'Decrease Hardness', shortcut: '{', t: K('{', 'BracketLeft', { shift: true }) },
    { name: 'Increase Hardness', shortcut: '}', t: K('}', 'BracketRight', { shift: true }) },
    { name: 'Find', shortcut: 'Ctrl+F', t: K('f', 'KeyF', { ctrl: true }) },
  ];

  /* ---------- state ---------- */

  let remaps = [];
  let recording = null; // {index, side}
  let pickerFor = null; // index editing target, null = adding new

  const $ = (id) => document.getElementById(id);
  const listEl = $('list');
  const overlayEl = $('overlay');
  const errEl = $('err');
  const pickerEl = $('picker');

  /* ---------- storage ---------- */

  function saved() {
    chrome.storage.sync.set({ remaps: remaps.map((r) => ({ trigger: r.trigger, target: r.target })) });
  }

  chrome.storage.sync.get({ enabled: true, remaps: [] }, function (r) {
    $('enabled').checked = r.enabled !== false;
    remaps = Array.isArray(r.remaps) ? r.remaps : [];
    render();
  });

  $('enabled').addEventListener('change', function () {
    chrome.storage.sync.set({ enabled: this.checked });
  });

  $('add').addEventListener('click', function () {
    pickerFor = null;
    openPicker();
  });

  /* ---------- render ---------- */

  function render() {
    listEl.innerHTML = '';
    remaps.forEach(function (r, i) {
      const row = document.createElement('div');
      row.className = 'row';

      const t = document.createElement('button');
      t.className = 'slot';
      t.innerHTML = labelOf(r.trigger, 'record trigger');
      t.title = 'Record the input that triggers it';
      t.addEventListener('click', () => startRec(i, 'trigger'));

      const mid = document.createElement('div');
      mid.className = 'mid';
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = '\u2192';

      const col = document.createElement('div');
      col.className = 'col';
      const g = document.createElement('button');
      g.className = 'slot';
      g.innerHTML = labelOf(r.target, 'choose action');
      g.title = (r.targetName || '') ? esc(r.targetName) : 'Change target action';
      g.addEventListener('click', () => { pickerFor = i; openPicker(); });

      const tname = document.createElement('div');
      tname.className = 'tname';
      tname.textContent = r.targetName || comboText(r.target || {});

      col.appendChild(g);
      col.appendChild(tname);

      const d = document.createElement('button');
      d.className = 'del';
      d.textContent = '\u00d7';
      d.title = 'Remove';
      d.addEventListener('click', () => { remaps.splice(i, 1); saved(); render(); });

      row.appendChild(t);
      mid.appendChild(arrow);
      row.appendChild(mid);
      row.appendChild(col);
      row.appendChild(d);
      listEl.appendChild(row);
    });
    if (recording) {
      const slots = listEl.querySelectorAll('.slot');
      const idx = recording.index * 2;
      if (slots[idx]) slots[idx].classList.add('rec');
    }
  }

  /* ---------- picker ---------- */

  let searchTerm = '';

  function openPicker() {
    pickerEl.classList.add('show');
    document.body.classList.add('pick');
    $('search').value = searchTerm;
    renderPicker();
    $('search').focus();
  }
  function closePicker() {
    pickerEl.classList.remove('show');
    document.body.classList.remove('pick');
  }

  function renderPicker() {
    const q = ($('search').value || '').trim().toLowerCase();
    const box = $('pickerList');
    box.innerHTML = '';
    const items = PRESETS.filter((p) =>
      !q || p.name.toLowerCase().includes(q) || p.shortcut.toLowerCase().includes(q));
    if (!items.length) {
      const e = document.createElement('div');
      e.className = 'pempty';
      e.textContent = 'No match.';
      box.appendChild(e);
      return;
    }
    items.forEach(function (p) {
      const b = document.createElement('button');
      b.className = 'pitem';
      b.innerHTML = '<span class="pn">' + esc(p.name) + '</span><span class="ps">' + esc(p.shortcut) + '</span>';
      b.addEventListener('click', () => choose(p));
      box.appendChild(b);
    });
  }

  $('search').addEventListener('input', renderPicker);
  $('pickerBack').addEventListener('click', function () { closePicker(); pickerFor = null; });

  function choose(p) {
    closePicker();
    let i = pickerFor;
    if (i === null) {
      remaps.push({ trigger: null, target: JSON.parse(JSON.stringify(p.t)), targetName: p.name });
      i = remaps.length - 1;
      saved();
      render();
    } else {
      remaps[i].target = JSON.parse(JSON.stringify(p.t));
      remaps[i].targetName = p.name;
      saved();
      render();
    }
    pickerFor = null;
    startRec(i, 'trigger');
  }

  /* ---------- recording ---------- */

  function startRec(index, side) {
    recording = { index: index, side: side };
    errEl.textContent = '';
    overlayEl.classList.add('show');
    render();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('contextmenu', onMouse, true);
    window.addEventListener('auxclick', onMouse, true);
    window.addEventListener('wheel', onWheel, true);
  }

  function stopRec() {
    recording = null;
    overlayEl.classList.remove('show');
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousedown', onMouse, true);
    window.removeEventListener('contextmenu', onMouse, true);
    window.removeEventListener('auxclick', onMouse, true);
    window.removeEventListener('wheel', onWheel, true);
  }

  function apply(desc) {
    if (!recording) return;
    remaps[recording.index][recording.side] = desc;
    saved();
    stopRec();
    render();
  }

  function onKey(e) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { stopRec(); render(); return; }
    const lower = e.key.toLowerCase();
    if (lower === 'control' || lower === 'alt' || lower === 'shift' || lower === 'meta') return;
    const d = {
      type: 'key',
      key: e.key,
      code: e.code,
      keyCode: e.keyCode || e.which || 0,
      mods: { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey },
    };
    if (isBrowserShortcut(d)) {
      errEl.textContent = 'Browser shortcut (' + comboText(d) + ') \u2014 not allowed.';
      return;
    }
    apply(d);
  }

  function onMouse(e) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.target && e.target.closest && e.target.closest('button')) { stopRec(); render(); return; }
    if (e.type === 'mousedown') apply({ type: 'mouse', button: e.button });
  }

  function onWheel(e) {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    const motion = ay > ax ? (e.deltaY > 0 ? 'down' : 'up') : (e.deltaX > 0 ? 'right' : 'left');
    apply({ type: 'wheel', motion: motion, mods: { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey } });
  }

  overlayEl.addEventListener('click', function (e) {
    if (recording && e.target && e.target.closest('#cancel')) { stopRec(); render(); }
  });
})();