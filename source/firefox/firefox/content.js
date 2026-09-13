(function () {
  'use strict';

  if (!/photopea\.com$/i.test(location.hostname)) return;

  let enabled = true;
  let remaps = [];

  function norm(list) {
    return Array.isArray(list) ? list : [];
  }

  function apply(r) {
    if (r.enabled !== undefined) enabled = r.enabled !== false;
    if (r.remaps) remaps = norm(r.remaps);
  }

  chrome.storage.sync.get({ enabled: true, remaps: [] }, apply);
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync') return;
    if ('enabled' in changes) enabled = changes.enabled.newValue !== false;
    if ('remaps' in changes) remaps = norm(changes.remaps.newValue);
  });

  /* ---------------- matching ---------------- */

  function inEditable() {
    const el = document.activeElement;
    if (!el) return false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
    return el.isContentEditable;
  }

  function sameMods(a, b) {
    if (!b) b = {};
    return !!a.ctrl === !!b.ctrl && !!a.alt === !!b.alt && !!a.shift === !!b.shift;
  }

  function matchKey(e) {
    const code = (e.code || '').toLowerCase();
    const key = (e.key || '').toLowerCase();
    for (const r of remaps) {
      const t = r.trigger;
      if (!t || t.type !== 'key') continue;
      const tc = (t.code || '').toLowerCase();
      const tk = (t.key || '').toLowerCase();
      if (!(!!tk && tk === key || !!tc && tc === code)) continue;
      if (!sameMods({ ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }, t.mods)) continue;
      return r;
    }
    return null;
  }

  function matchMouse(e) {
    for (const r of remaps) {
      const t = r.trigger;
      if (t && t.type === 'mouse' && t.button === e.button) return r;
    }
    return null;
  }

  function matchWheel(e) {
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    const motion = ay > ax ? (e.deltaY > 0 ? 'down' : 'up') : (e.deltaX > 0 ? 'right' : 'left');
    const evMods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
    for (const r of remaps) {
      const t = r.trigger;
      if (t && t.type === 'wheel' && t.motion === motion && sameMods(evMods, t.mods)) return r;
    }
    return null;
  }

  /* ---------------- synthetic dispatch ---------------- */

  function mk(type, init) {
    const opts = Object.assign({ bubbles: true, cancelable: true, composed: true, view: window }, init);
    const ev = new KeyboardEvent(type, opts);
    if (opts.keyCode) {
      Object.defineProperty(ev, 'keyCode', { get: () => opts.keyCode });
      Object.defineProperty(ev, 'which', { get: () => opts.keyCode });
    }
    return ev;
  }

  function targetFor(e) {
    return (e && e.target) || document.activeElement || document.body || document;
  }

  function send(target, ev) {
    target.dispatchEvent(ev);
    return ev;
  }

  const MOD_KEYS = { Control: 'ctrl', Alt: 'alt', Shift: 'shift' };

  function fireKey(bubblesTarget, d, isDown) {
    const t = targetFor(bubblesTarget);
    const mods = d.mods || {};
    const all = { ctrl: !!mods.ctrl, alt: !!mods.alt, shift: !!mods.shift };
    const mainMod = MOD_KEYS[d.key];
    const order = [];
    if (mods.ctrl && mainMod !== 'ctrl') order.push({ key: 'Control', code: 'ControlLeft', keyCode: 17, flag: 'ctrl' });
    if (mods.alt && mainMod !== 'alt') order.push({ key: 'Alt', code: 'AltLeft', keyCode: 18, flag: 'alt' });
    if (mods.shift && mainMod !== 'shift') order.push({ key: 'Shift', code: 'ShiftLeft', keyCode: 16, flag: 'shift' });

    if (isDown) {
      const active = { ctrl: false, alt: false, shift: false };
      for (const m of order) {
        active[m.flag] = true;
        send(t, mk('keydown', Object.assign({ key: m.key, code: m.code, keyCode: m.keyCode }, active)));
      }
      send(t, mk('keydown', Object.assign({ key: d.key, code: d.code, keyCode: d.keyCode }, all)));
    } else {
      send(t, mk('keyup', Object.assign({ key: d.key, code: d.code, keyCode: d.keyCode }, all)));
      for (const m of order.slice().reverse()) {
        all[m.flag] = false;
        send(t, mk('keyup', Object.assign({ key: m.key, code: m.code, keyCode: m.keyCode }, all)));
      }
    }
  }

  function fireMouse(bubblesTarget, d) {
    const t = targetFor(bubblesTarget);
    const init = { button: d.button, view: window };
    send(t, new MouseEvent('mousedown', Object.assign({}, init, { buttons: 1 << d.button })));
    send(t, new MouseEvent('mouseup', Object.assign({}, init, { buttons: 0 })));
    send(t, new MouseEvent(d.button === 0 ? 'click' : 'auxclick', Object.assign({}, init, { buttons: 0 })));
    if (d.button === 2) send(t, new MouseEvent('contextmenu', Object.assign({}, init, { buttons: 0 })));
  }

  function fireWheel(bubblesTarget, d) {
    const t = targetFor(bubblesTarget);
    const m = d.mods || {};
    const init = { deltaMode: 0, view: window, ctrlKey: !!m.ctrl, altKey: !!m.alt, shiftKey: !!m.shift };
    if (d.motion === 'up') init.deltaY = -120;
    else if (d.motion === 'down') init.deltaY = 120;
    else if (d.motion === 'left') init.deltaX = -120;
    else init.deltaX = 120;
    send(t, new WheelEvent('wheel', init));
  }

  function execute(e, r) {
    const d = r.target;
    if (!d) return;
    if (d.type === 'key') fireKey(e, d, true);
    else if (d.type === 'mouse') fireMouse(e, d);
    else if (d.type === 'wheel') fireWheel(e, d);
  }

  function steal(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  let stolenButton = -1;

  function handleDown(e) {
    if (!enabled || inEditable()) return;
    if (e.type !== 'keydown') return;
    if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') return;
    const r = matchKey(e);
    if (r) { steal(e); execute(e, r); }
  }

  function handleMouse(e) {
    if (!enabled) return;
    if (e.type === 'mouseup' || e.type === 'click' || e.type === 'auxclick') {
      if (stolenButton === e.button) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        stolenButton = -1;
      }
      return;
    }
    const r = matchMouse(e);
    if (r) { steal(e); stolenButton = e.button; execute(e, r); }
    else stolenButton = -1;
  }

  function handleWheel(e) {
    if (!enabled) return;
    const r = matchWheel(e);
    if (r) { steal(e); execute(e, r); }
  }

  window.addEventListener('keydown', handleDown, true);
  window.addEventListener('mousedown', handleMouse, true);
  window.addEventListener('mouseup', handleMouse, true);
  window.addEventListener('auxclick', handleMouse, true);
  window.addEventListener('contextmenu', handleMouse, true);
  window.addEventListener('wheel', handleWheel, true);
})();