/* 依存なしの XLSX / CSV 読み込み
   xlsx は ZIP なので、ブラウザ内蔵の DecompressionStream('deflate-raw') で展開する。
   XlsxReader.read(file) -> Promise<{sheets:[{name, rows:[[cell,...]]}]}> */
(function (global) {
  'use strict';

  function u16(d, p) { return d[p] | (d[p + 1] << 8); }
  function u32(d, p) { return (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0; }

  /* ---------- ZIP を読む ---------- */
  async function unzip(buf) {
    const d = new Uint8Array(buf);
    // End of central directory を末尾から探す
    let eocd = -1;
    for (let i = d.length - 22; i >= 0 && i > d.length - 66000; i--) {
      if (u32(d, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP形式ではありません');
    const count = u16(d, eocd + 10);
    let p = u32(d, eocd + 16);
    const files = {};
    for (let i = 0; i < count; i++) {
      if (u32(d, p) !== 0x02014b50) break;
      const method = u16(d, p + 10);
      const csize = u32(d, p + 20);
      const nameLen = u16(d, p + 28), extraLen = u16(d, p + 30), cmtLen = u16(d, p + 32);
      const lho = u32(d, p + 42);
      const name = new TextDecoder('utf-8').decode(d.subarray(p + 46, p + 46 + nameLen));
      // ローカルヘッダから実データ位置を求める
      const lNameLen = u16(d, lho + 26), lExtraLen = u16(d, lho + 28);
      const start = lho + 30 + lNameLen + lExtraLen;
      files[name] = { method, data: d.subarray(start, start + csize) };
      p += 46 + nameLen + extraLen + cmtLen;
    }
    const out = {};
    for (const name in files) {
      const f = files[name];
      if (f.method === 0) out[name] = f.data;
      else if (f.method === 8) out[name] = await inflateRaw(f.data);
      // それ以外の圧縮方式は無視
    }
    return out;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('このブラウザはxlsxの展開に対応していません。CSV形式で保存してからお試しください。');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }

  /* ---------- XML を軽く読む ---------- */
  function parseXML(bytes) {
    const text = new TextDecoder('utf-8').decode(bytes);
    return new DOMParser().parseFromString(text, 'application/xml');
  }

  function colToIndex(ref) {          // "BC12" -> 54
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
      const c = ref.charCodeAt(i);
      if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
      else break;
    }
    return n - 1;
  }

  /* ---------- xlsx 本体 ---------- */
  async function readXlsx(buf) {
    const zip = await unzip(buf);
    // 共有文字列
    let shared = [];
    if (zip['xl/sharedStrings.xml']) {
      const doc = parseXML(zip['xl/sharedStrings.xml']);
      shared = [...doc.getElementsByTagName('si')].map(si =>
        [...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
    }
    // シート名と対応ファイル
    const wb = zip['xl/workbook.xml'] ? parseXML(zip['xl/workbook.xml']) : null;
    const rels = zip['xl/_rels/workbook.xml.rels'] ? parseXML(zip['xl/_rels/workbook.xml.rels']) : null;
    const relMap = {};
    if (rels) [...rels.getElementsByTagName('Relationship')].forEach(r =>
      relMap[r.getAttribute('Id')] = r.getAttribute('Target'));
    const sheets = [];
    const entries = wb ? [...wb.getElementsByTagName('sheet')] : [];
    if (entries.length) {
      entries.forEach((sh, i) => {
        const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        let target = relMap[rid] || ('worksheets/sheet' + (i + 1) + '.xml');
        target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
        const key = 'xl/' + target;
        if (zip[key]) sheets.push({ name: sh.getAttribute('name') || ('シート' + (i + 1)), xml: zip[key] });
      });
    }
    if (!sheets.length) {
      Object.keys(zip).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()
        .forEach((k, i) => sheets.push({ name: 'シート' + (i + 1), xml: zip[k] }));
    }
    return {
      sheets: sheets.map(s => ({ name: s.name, rows: readSheet(s.xml, shared) }))
    };
  }

  function readSheet(xml, shared) {
    const doc = parseXML(xml);
    const rows = [];
    [...doc.getElementsByTagName('row')].forEach(row => {
      const arr = [];
      [...row.getElementsByTagName('c')].forEach(c => {
        const ref = c.getAttribute('r') || '';
        const idx = ref ? colToIndex(ref) : arr.length;
        const t = c.getAttribute('t');
        let v = '';
        if (t === 'inlineStr') {
          v = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        } else {
          const vEl = c.getElementsByTagName('v')[0];
          const raw = vEl ? vEl.textContent : '';
          if (t === 's') v = shared[parseInt(raw, 10)] || '';
          else v = raw;
        }
        while (arr.length < idx) arr.push('');
        arr[idx] = v;
      });
      rows.push(arr);
    });
    // 末尾の空行を落とす
    while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
    return rows;
  }

  /* ---------- CSV / TSV ---------- */
  function readDelimited(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l !== '');
    if (!lines.length) return [];
    const tab = lines[0].split('\t').length > 1;
    return lines.map(l => tab ? l.split('\t') : splitCSV(l));
  }
  function splitCSV(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }

  /* ---------- 入口 ---------- */
  async function read(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
      const buf = await file.arrayBuffer();
      return await readXlsx(buf);
    }
    if (name.endsWith('.xls')) {
      throw new Error('古い形式（.xls）は読み込めません。Excelで「.xlsx」または「CSV」として保存し直してください。');
    }
    let text = await file.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return { sheets: [{ name: file.name || 'データ', rows: readDelimited(text) }] };
  }

  global.XlsxReader = { read, readDelimited };
})(window);
