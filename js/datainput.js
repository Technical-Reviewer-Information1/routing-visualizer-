/* データ入力パネル（ファイル読み込み＋セル入力グリッド）
   DataInput.create(container, {header, data, onChange(rows, header), title}) */
(function (global) {
  'use strict';
  function create(container, opt) {
    opt = opt || {};
    container.innerHTML =
      '<div class="filebox">' +
        '<label class="filelabel">ファイルを読み込む<input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt"></label>' +
        '<select class="sel sheetsel" hidden aria-label="シートを選ぶ"></select>' +
        '<label style="font-size:.82rem;display:flex;align-items:center;gap:6px">' +
          '<input type="checkbox" class="hdrchk" checked> 1行目を見出しとして使う</label>' +
        '<span class="dg-hint">Excel(.xlsx)・CSV に対応。読み込んだ内容は下の表で直接なおせます。</span>' +
      '</div>' +
      '<div class="filemsg" style="margin-top:10px"></div>' +
      '<div class="gridhost" style="margin-top:12px"></div>';

    const fileInput = container.querySelector('input[type=file]');
    const sheetSel = container.querySelector('.sheetsel');
    const hdrChk = container.querySelector('.hdrchk');
    const msg = container.querySelector('.filemsg');
    let book = null;

    const grid = global.DataGrid.create(container.querySelector('.gridhost'), {
      header: opt.header || ['列1', '列2'],
      data: opt.data || [['', '']],
      minRows: opt.minRows || 3,
      onChange: (rows, header) => { if (opt.onChange) opt.onChange(rows, header); }
    });

    function note(kind, text) {
      msg.className = 'note ' + kind;
      msg.innerHTML = text;
      msg.hidden = false;
    }
    function applySheet() {
      if (!book) return;
      const s = book.sheets[+sheetSel.value || 0];
      if (!s || !s.rows.length) { note('ng', 'このシートにはデータがありません。'); return; }
      let rows = s.rows.map(r => r.map(c => String(c == null ? '' : c)));
      let header;
      if (hdrChk.checked && rows.length > 1) { header = rows[0]; rows = rows.slice(1); }
      else header = rows[0].map((_, j) => '列' + (j + 1));
      grid.setData(rows, header);
      note('ok', '<strong>' + s.name + '</strong> を読み込みました（' + rows.length + ' 行 × ' + header.length + ' 列）。' +
        '表のセルをクリックすれば、そのまま書きかえられます。');
    }

    fileInput.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      note('info', '読み込んでいます…');
      try {
        book = await global.XlsxReader.read(f);
        if (book.sheets.length > 1) {
          sheetSel.hidden = false;
          sheetSel.innerHTML = book.sheets.map((s, i) => '<option value="' + i + '">' + s.name + '</option>').join('');
        } else sheetSel.hidden = true;
        sheetSel.value = 0;
        applySheet();
      } catch (err) {
        note('ng', '読み込めませんでした。' + (err && err.message ? err.message : '') +
          '<br>Excel の場合は「.xlsx」形式か、CSV として保存し直してお試しください。');
      }
    });
    sheetSel.addEventListener('change', applySheet);
    hdrChk.addEventListener('change', applySheet);

    return grid;
  }
  global.DataInput = { create };
})(window);
