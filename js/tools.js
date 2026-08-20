/* 情報Ⅰ Webアプリ共通ツール
   ・表計算ソフトからの貼り付け（TSV/CSV）解析
   ・グラフのPNG保存
   ・URLで状態を共有
   ・印刷 */
(function (global) {
  'use strict';

  /* ---------- 貼り付けデータの解析 ---------- */
  function parseTable(text) {
    const lines = String(text).replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return { header: [], rows: [] };
    const sep = lines[0].indexOf('\t') >= 0 ? '\t' : (lines[0].indexOf(',') >= 0 ? ',' : /\s+/);
    const split = l => (sep instanceof RegExp ? l.trim().split(sep) : l.split(sep)).map(c => c.trim());
    const cells = lines.map(split);
    const first = cells[0];
    const headerLooksText = first.some(c => c !== '' && isNaN(Number(c)));
    const header = headerLooksText ? first : first.map((_, i) => '列' + (i + 1));
    const rows = (headerLooksText ? cells.slice(1) : cells);
    return { header, rows };
  }
  /** 数値だけの1列を取り出す */
  function numbers(text) {
    return String(text).split(/[\s,、\t\n]+/).map(s => parseFloat(s))
      .filter(v => Number.isFinite(v));
  }

  /* ---------- PNG 保存 ---------- */
  function saveSVG(svg, filename) {
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // 変数で指定された色を実際の値に置き換える
    const cs = getComputedStyle(document.documentElement);
    let str = new XMLSerializer().serializeToString(clone);
    str = str.replace(/var\(--([a-z0-9-]+)\)/g, (m, n) => cs.getPropertyValue('--' + n).trim() || '#333');
    const vb = (svg.getAttribute('viewBox') || '0 0 800 600').split(/\s+/).map(Number);
    const w = vb[2] || 800, h = vb[3] || 600, scale = 2;
    const img = new Image();
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>' + str], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = function () {
      const cv = document.createElement('canvas');
      cv.width = w * scale; cv.height = h * scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = (filename || 'graph') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); alert('画像の保存に失敗しました。ブラウザを変えてお試しください。'); };
    img.src = url;
  }

  /** 「この図を保存」ボタンを作る */
  function saveButton(getSvg, filename, label) {
    const b = document.createElement('button');
    b.className = 'btn sm ghost';
    b.textContent = label || 'この図をPNGで保存';
    b.addEventListener('click', () => saveSVG(typeof getSvg === 'function' ? getSvg() : getSvg, filename));
    return b;
  }

  /* ---------- URL で状態を共有 ---------- */
  function encodeState(obj) {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, ''); }
    catch (e) { return ''; }
  }
  function decodeState(str) {
    try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
    catch (e) { return null; }
  }
  function readShared() {
    const h = location.hash.replace(/^#d=/, '');
    return h && location.hash.indexOf('#d=') === 0 ? decodeState(h) : null;
  }
  function share(obj, btn) {
    const url = location.origin + location.pathname + '#d=' + encodeState(obj);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => flash(btn, 'URLをコピーしました'), () => prompt('このURLを共有してください', url));
    } else prompt('このURLを共有してください', url);
    history.replaceState(null, '', '#d=' + encodeState(obj));
  }
  function flash(btn, msg) {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = old; }, 1800);
  }

  function printPage() { window.print(); }

  global.Tools = { parseTable, numbers, saveSVG, saveButton, share, readShared, encodeState, decodeState, printPage, flash };
})(window);
