/* 表計算のように直接セルへ入力できるグリッド
   const g = DataGrid.create(el, {header:[...], data:[[...]], onChange(){}}) */
(function (global) {
  'use strict';

  /** 「1番」のような文字は数値とみなさない厳密な変換 */
  function strNum(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(/,/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function create(container, opt) {
    opt = opt || {};
    const st = {
      header: (opt.header || ['列1', '列2']).slice(),
      data: (opt.data || [['', '']]).map(r => r.slice()),
      onChange: opt.onChange || function () {},
      minRows: opt.minRows || 1,
      numericHint: opt.numericHint !== false
    };

    const wrap = document.createElement('div');
    wrap.className = 'dg-wrap';
    container.innerHTML = '';
    container.appendChild(wrap);

    function normalize() {
      const cols = st.header.length;
      st.data.forEach(r => { while (r.length < cols) r.push(''); r.length = cols; });
      while (st.data.length < st.minRows) st.data.push(new Array(cols).fill(''));
    }

    function render() {
      normalize();
      const cols = st.header.length;
      let h = '<div class="dg-scroll"><table class="dg"><thead><tr><th class="dg-corner"></th>';
      st.header.forEach((c, j) => {
        h += '<th><input class="dg-h" data-j="' + j + '" value="' + esc(c) + '" aria-label="' + (j + 1) + '列目の見出し"></th>';
      });
      h += '<th class="dg-act"></th></tr></thead><tbody>';
      st.data.forEach((row, i) => {
        h += '<tr><th class="dg-n">' + (i + 1) + '</th>';
        row.forEach((v, j) => {
          h += '<td><input class="dg-c" data-i="' + i + '" data-j="' + j + '" value="' + esc(v) +
               '" aria-label="' + (i + 1) + '行' + (j + 1) + '列"></td>';
        });
        h += '<td class="dg-act"><button class="dg-del" data-i="' + i + '" title="この行を削除" aria-label="' + (i + 1) + '行目を削除">×</button></td></tr>';
      });
      h += '</tbody></table></div>';
      h += '<div class="dg-tools">' +
        '<button class="btn sm" data-dg="addRow">＋ 行を追加</button>' +
        '<button class="btn sm" data-dg="addRow10">＋ 10行</button>' +
        '<button class="btn sm" data-dg="addCol">＋ 列を追加</button>' +
        '<button class="btn sm ghost" data-dg="delCol">− 列を削除</button>' +
        '<button class="btn sm ghost" data-dg="clear">全部消す</button>' +
        '<span class="dg-hint">セルをクリックして直接入力できます。Enter で下、Tab で右へ移動。表計算ソフトからそのまま貼り付けもできます。</span>' +
        '</div>';
      wrap.innerHTML = h;
      bind();
    }
    function esc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

    function bind() {
      wrap.querySelectorAll('.dg-h').forEach(inp => {
        inp.addEventListener('input', e => { st.header[+e.target.dataset.j] = e.target.value; fire(); });
      });
      wrap.querySelectorAll('.dg-c').forEach(inp => {
        inp.addEventListener('input', e => {
          st.data[+e.target.dataset.i][+e.target.dataset.j] = e.target.value;
          markNumeric(e.target); fire();
        });
        inp.addEventListener('keydown', onKey);
        inp.addEventListener('paste', onPaste);
        inp.addEventListener('focus', e => e.target.select());
        markNumeric(inp);
      });
      wrap.querySelectorAll('.dg-del').forEach(b => b.addEventListener('click', e => {
        const i = +e.currentTarget.dataset.i;
        if (st.data.length <= st.minRows) { st.data[i] = st.header.map(() => ''); }
        else st.data.splice(i, 1);
        render(); fire();
      }));
      wrap.querySelectorAll('[data-dg]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.dg;
        if (a === 'addRow') st.data.push(st.header.map(() => ''));
        else if (a === 'addRow10') for (let k = 0; k < 10; k++) st.data.push(st.header.map(() => ''));
        else if (a === 'addCol') { st.header.push('列' + (st.header.length + 1)); st.data.forEach(r => r.push('')); }
        else if (a === 'delCol') {
          if (st.header.length > 1) { st.header.pop(); st.data.forEach(r => r.pop()); }
        } else if (a === 'clear') st.data = [st.header.map(() => '')];
        render(); fire();
      }));
    }
    function markNumeric(inp) {
      if (!st.numericHint) return;
      inp.classList.toggle('num', strNum(inp.value) !== null);
    }

    function cell(i, j) { return wrap.querySelector('.dg-c[data-i="' + i + '"][data-j="' + j + '"]'); }
    function onKey(e) {
      const i = +e.target.dataset.i, j = +e.target.dataset.j;
      let t = null;
      if (e.key === 'Enter') { t = cell(i + 1, j) || (addRowAndGet(j)); }
      else if (e.key === 'ArrowDown') t = cell(i + 1, j);
      else if (e.key === 'ArrowUp') t = cell(i - 1, j);
      else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) t = cell(i, j + 1);
      else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) t = cell(i, j - 1);
      if (t) { e.preventDefault(); t.focus(); t.select(); }
    }
    function addRowAndGet(j) {
      st.data.push(st.header.map(() => ''));
      const i = st.data.length - 1;
      render(); fire();
      return cell(i, j);
    }
    function onPaste(e) {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text || (text.indexOf('\t') < 0 && text.indexOf('\n') < 0)) return;   // 単一セルは通常動作
      e.preventDefault();
      const i0 = +e.target.dataset.i, j0 = +e.target.dataset.j;
      const rows = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
        .map(l => l.indexOf('\t') >= 0 ? l.split('\t') : l.split(','));
      rows.forEach((r, di) => {
        const i = i0 + di;
        while (st.data.length <= i) st.data.push(st.header.map(() => ''));
        r.forEach((v, dj) => {
          const j = j0 + dj;
          while (st.header.length <= j) { st.header.push('列' + (st.header.length + 1)); st.data.forEach(x => x.push('')); }
          st.data[i][j] = v.trim();
        });
      });
      render(); fire();
    }

    let timer = null;
    function fire() {
      clearTimeout(timer);
      timer = setTimeout(() => st.onChange(api.getData(), st.header.slice()), 120);
    }

    const api = {
      render,
      getHeader: () => st.header.slice(),
      getData: () => st.data.map(r => r.slice()).filter(r => r.some(c => String(c).trim() !== '')),
      getRaw: () => st.data.map(r => r.slice()),
      /** j 列目の数値だけを取り出す */
      column: j => st.data.map(r => strNum(r[j])).filter(v => v !== null),
      /** 数値が多い列の番号を返す */
      numericColumns: () => st.header.map((_, j) => j).filter(j => {
        const col = st.data.map(r => r[j]).filter(v => String(v).trim() !== '');
        if (!col.length) return false;
        return col.filter(v => strNum(v) !== null).length >= col.length * 0.8;
      }),
      setData(rows, header) {
        if (header && header.length) st.header = header.slice();
        st.data = (rows && rows.length ? rows : [st.header.map(() => '')]).map(r => r.slice());
        render(); fire();
      },
      focusCell(i, j) { const c = cell(i, j); if (c) { c.focus(); c.select(); } }
    };
    render();
    return api;
  }

  global.DataGrid = { create, strNum };
})(window);
