/* 情報Ⅰ Webアプリ共通 作図ライブラリ（依存なし・SVG）
   すべて Chart.<種類>(container, options) の形で呼ぶ。 */
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#15181c', INK2 = '#4a4f57', INK3 = '#858a92', RULE = '#d7d3cb', GRID = '#ebe8e2';
  const ACC = '#123a6b';
  const PALETTE = ['#123a6b', '#8a5a00', '#1f7a3d', '#0f6a78', '#8a2f1f', '#4a4f57', '#5a3d8a', '#7a1f5a'];

  function el(n, a, t) {
    const e = document.createElementNS(NS, n);
    for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (t != null) e.textContent = t;
    return e;
  }
  function svgRoot(box, w, h, label) {
    box.innerHTML = '';
    const s = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: null,
      preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': label || 'グラフ' });
    s.style.display = 'block';
    s.style.maxHeight = h + 'px';
    box.appendChild(s);
    return s;
  }
  function niceStep(range, target) {
    const raw = range / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }
  function fmt(v) {
    if (Math.abs(v) >= 10000) return v.toLocaleString('ja-JP');
    return (Math.round(v * 1000) / 1000).toString();
  }

  /* 軸つきの枠を用意する共通処理 */
  function frame(s, o) {
    const W = o.W, H = o.H;
    const m = Object.assign({ t: 22, r: 18, b: 46, l: 56 }, o.margin);
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const g = el('g', {});
    s.appendChild(g);
    return { m, iw, ih, g };
  }
  function yAxis(g, m, iw, ih, lo, hi, unit, ticks) {
    const step = niceStep(hi - lo, ticks || 5);
    const start = Math.ceil(lo / step) * step;
    for (let v = start; v <= hi + 1e-9; v += step) {
      const y = m.t + ih - (v - lo) / (hi - lo) * ih;
      g.appendChild(el('line', { x1: m.l, y1: y, x2: m.l + iw, y2: y, stroke: GRID, 'stroke-width': 1 }));
      g.appendChild(el('text', { x: m.l - 8, y: y, 'text-anchor': 'end', 'dominant-baseline': 'middle',
        'font-size': 11, fill: INK3, 'font-family': 'monospace' }, fmt(v)));
    }
    g.appendChild(el('line', { x1: m.l, y1: m.t, x2: m.l, y2: m.t + ih, stroke: RULE, 'stroke-width': 1.4 }));
    g.appendChild(el('line', { x1: m.l, y1: m.t + ih, x2: m.l + iw, y2: m.t + ih, stroke: INK2, 'stroke-width': 1.4 }));
    if (unit) g.appendChild(el('text', { x: m.l - 8, y: m.t - 8, 'text-anchor': 'end',
      'font-size': 10, fill: INK3 }, unit));
  }
  function xLabels(g, m, iw, ih, labels, rotate) {
    const bw = iw / labels.length;
    labels.forEach((lb, i) => {
      const x = m.l + bw * (i + .5);
      const t = el('text', { x: x, y: m.t + ih + 16, 'text-anchor': rotate ? 'end' : 'middle',
        'font-size': 11, fill: INK2 }, lb);
      if (rotate) t.setAttribute('transform', `rotate(-38 ${x} ${m.t + ih + 16})`);
      g.appendChild(t);
    });
  }

  /* ---------- 棒グラフ ---------- */
  function bar(box, o) {
    const W = o.W || 560, H = o.H || 300;
    const s = svgRoot(box, W, H, o.aria || '棒グラフ');
    const f = frame(s, { W, H, margin: o.margin });
    const vals = o.values;
    const dataMax = Math.max(...vals, 0), dataMin = Math.min(...vals, 0);
    const lo = (o.yMin != null) ? o.yMin : dataMin;
    const hi = (o.yMax != null) ? o.yMax : dataMax + (dataMax - lo) * .12 || 1;
    yAxis(f.g, f.m, f.iw, f.ih, lo, hi, o.unit);
    const bw = f.iw / vals.length, pad = bw * .22;
    vals.forEach((v, i) => {
      const yv = Math.min(Math.max(v, lo), hi);
      const y = f.m.t + f.ih - (yv - lo) / (hi - lo) * f.ih;
      const h = Math.max(0, f.m.t + f.ih - y);
      f.g.appendChild(el('rect', { x: f.m.l + bw * i + pad, y: y, width: bw - pad * 2, height: h,
        fill: (o.colors && o.colors[i]) || o.color || ACC }));
      if (o.showValue !== false)
        f.g.appendChild(el('text', { x: f.m.l + bw * (i + .5), y: y - 6, 'text-anchor': 'middle',
          'font-size': 11, fill: INK2, 'font-family': 'monospace' }, fmt(v)));
    });
    xLabels(f.g, f.m, f.iw, f.ih, o.labels, o.rotate);
    return s;
  }

  /* ---------- 折れ線グラフ ---------- */
  function line(box, o) {
    const W = o.W || 560, H = o.H || 300;
    const s = svgRoot(box, W, H, o.aria || '折れ線グラフ');
    const f = frame(s, { W, H, margin: o.margin });
    const series = o.series || [{ values: o.values, name: '' }];
    const all = series.flatMap(x => x.values);
    const dataMax = Math.max(...all), dataMin = Math.min(...all);
    const pad = (dataMax - dataMin) * .12 || 1;
    const lo = (o.yMin != null) ? o.yMin : dataMin - pad;
    const hi = (o.yMax != null) ? o.yMax : dataMax + pad;
    yAxis(f.g, f.m, f.iw, f.ih, lo, hi, o.unit);
    const n = series[0].values.length, sp = f.iw / Math.max(1, n - 1);
    series.forEach((se, si) => {
      const col = se.color || PALETTE[si % PALETTE.length];
      const pts = se.values.map((v, i) => [f.m.l + sp * i, f.m.t + f.ih - (v - lo) / (hi - lo) * f.ih]);
      f.g.appendChild(el('polyline', { points: pts.map(p => p.join(',')).join(' '),
        fill: 'none', stroke: col, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
      pts.forEach((p, i) => {
        f.g.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.4, fill: '#fff', stroke: col, 'stroke-width': 2 }));
        if (o.showValue)
          f.g.appendChild(el('text', { x: p[0], y: p[1] - 10, 'text-anchor': 'middle',
            'font-size': 10, fill: INK2, 'font-family': 'monospace' }, fmt(se.values[i])));
      });
    });
    const bw = f.iw / Math.max(1, n - 1);
    (o.labels || []).forEach((lb, i) => {
      f.g.appendChild(el('text', { x: f.m.l + bw * i, y: f.m.t + f.ih + 16, 'text-anchor': 'middle',
        'font-size': 11, fill: INK2 }, lb));
    });
    return s;
  }

  /* ---------- 円グラフ ---------- */
  function pie(box, o) {
    const W = o.W || 420, H = o.H || 300;
    const s = svgRoot(box, W, H, o.aria || '円グラフ');
    const cx = W * .36, cy = H / 2, r = Math.min(W * .3, H * .40);
    const total = o.values.reduce((a, b) => a + b, 0) || 1;
    let acc = -Math.PI / 2;
    o.values.forEach((v, i) => {
      const a = v / total * Math.PI * 2, col = PALETTE[i % PALETTE.length];
      const x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
      const x2 = cx + r * Math.cos(acc + a), y2 = cy + r * Math.sin(acc + a);
      s.appendChild(el('path', { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${a > Math.PI ? 1 : 0},1 ${x2},${y2} Z`,
        fill: col, stroke: '#fff', 'stroke-width': 1.5 }));
      const mid = acc + a / 2;
      if (v / total > .05)
        s.appendChild(el('text', { x: cx + r * .62 * Math.cos(mid), y: cy + r * .62 * Math.sin(mid),
          'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 11, fill: '#fff',
          'font-weight': 700, 'font-family': 'monospace' }, Math.round(v / total * 100) + '%'));
      acc += a;
    });
    o.labels.forEach((lb, i) => {
      const y = 30 + i * 21;
      s.appendChild(el('rect', { x: W * .70, y: y - 8, width: 11, height: 11, fill: PALETTE[i % PALETTE.length] }));
      s.appendChild(el('text', { x: W * .70 + 17, y: y, 'dominant-baseline': 'middle',
        'font-size': 11, fill: INK2 }, lb));
    });
    return s;
  }

  /* ---------- 散布図 ---------- */
  function scatter(box, o) {
    const W = o.W || 480, H = o.H || 360;
    const s = svgRoot(box, W, H, o.aria || '散布図');
    const f = frame(s, { W, H, margin: Object.assign({ t: 22, r: 18, b: 46, l: 52 }, o.margin) });
    const xs = o.points.map(p => p[0]), ys = o.points.map(p => p[1]);
    const xlo = o.xMin != null ? o.xMin : Math.min(...xs) - (Math.max(...xs) - Math.min(...xs)) * .1 || 0;
    const xhi = o.xMax != null ? o.xMax : Math.max(...xs) + (Math.max(...xs) - Math.min(...xs)) * .1 || 1;
    const ylo = o.yMin != null ? o.yMin : Math.min(...ys) - (Math.max(...ys) - Math.min(...ys)) * .1 || 0;
    const yhi = o.yMax != null ? o.yMax : Math.max(...ys) + (Math.max(...ys) - Math.min(...ys)) * .1 || 1;
    yAxis(f.g, f.m, f.iw, f.ih, ylo, yhi, o.yUnit);
    const X = v => f.m.l + (v - xlo) / (xhi - xlo) * f.iw;
    const Y = v => f.m.t + f.ih - (v - ylo) / (yhi - ylo) * f.ih;
    const xstep = niceStep(xhi - xlo, 5);
    for (let v = Math.ceil(xlo / xstep) * xstep; v <= xhi + 1e-9; v += xstep) {
      f.g.appendChild(el('line', { x1: X(v), y1: f.m.t, x2: X(v), y2: f.m.t + f.ih, stroke: GRID, 'stroke-width': 1 }));
      f.g.appendChild(el('text', { x: X(v), y: f.m.t + f.ih + 16, 'text-anchor': 'middle',
        'font-size': 11, fill: INK3, 'font-family': 'monospace' }, fmt(v)));
    }
    if (o.regression) {
      const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
      let sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
      const a = sxx ? sxy / sxx : 0, b = my - a * mx;
      f.g.appendChild(el('line', { x1: X(xlo), y1: Y(a * xlo + b), x2: X(xhi), y2: Y(a * xhi + b),
        stroke: '#8a5a00', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
    }
    o.points.forEach((p, i) => {
      f.g.appendChild(el('circle', { cx: X(p[0]), cy: Y(p[1]), r: o.r || 5,
        fill: (o.colors && o.colors[i]) || 'rgba(18,58,107,.72)', stroke: '#fff', 'stroke-width': 1 }));
    });
    if (o.xLabel) f.g.appendChild(el('text', { x: f.m.l + f.iw / 2, y: H - 6, 'text-anchor': 'middle',
      'font-size': 11, fill: INK2 }, o.xLabel));
    if (o.yLabel) f.g.appendChild(el('text', { x: 12, y: f.m.t + f.ih / 2, 'text-anchor': 'middle',
      'font-size': 11, fill: INK2, transform: `rotate(-90 12 ${f.m.t + f.ih / 2})` }, o.yLabel));
    return s;
  }

  /* ---------- ヒストグラム ---------- */
  function hist(box, o) {
    const W = o.W || 560, H = o.H || 300;
    const s = svgRoot(box, W, H, o.aria || 'ヒストグラム');
    const f = frame(s, { W, H, margin: o.margin });
    const hi = Math.max(...o.counts) * 1.15 || 1;
    yAxis(f.g, f.m, f.iw, f.ih, 0, hi, o.unit || '度数');
    const bw = f.iw / o.counts.length;
    o.counts.forEach((c, i) => {
      const h = c / hi * f.ih;
      f.g.appendChild(el('rect', { x: f.m.l + bw * i, y: f.m.t + f.ih - h, width: bw - 1, height: h,
        fill: (o.highlight === i) ? '#8a5a00' : ACC, stroke: '#fff', 'stroke-width': 1 }));
      if (c > 0) f.g.appendChild(el('text', { x: f.m.l + bw * (i + .5), y: f.m.t + f.ih - h - 6,
        'text-anchor': 'middle', 'font-size': 10, fill: INK2, 'font-family': 'monospace' }, c));
    });
    (o.edges || []).forEach((e, i) => {
      if (o.edges.length > 9 && i % 2) return;
      f.g.appendChild(el('text', { x: f.m.l + bw * i, y: f.m.t + f.ih + 15, 'text-anchor': 'middle',
        'font-size': 10, fill: INK3, 'font-family': 'monospace' }, fmt(e)));
    });
    return s;
  }

  /* ---------- 箱ひげ図（横向き・複数可） ---------- */
  function box5(box, o) {
    const rows = o.rows;                       // [{name, min,q1,med,q3,max, outliers:[]}]
    const W = o.W || 560, H = o.H || (52 * rows.length + 60);
    const s = svgRoot(box, W, H, o.aria || '箱ひげ図');
    const m = { t: 18, r: 18, b: 34, l: o.labelW || 78 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const all = rows.flatMap(r => [r.min, r.max].concat(r.outliers || []));
    const lo = o.xMin != null ? o.xMin : Math.min(...all) - (Math.max(...all) - Math.min(...all)) * .08;
    const hi = o.xMax != null ? o.xMax : Math.max(...all) + (Math.max(...all) - Math.min(...all)) * .08;
    const X = v => m.l + (v - lo) / (hi - lo) * iw;
    const step = niceStep(hi - lo, 6);
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      s.appendChild(el('line', { x1: X(v), y1: m.t, x2: X(v), y2: m.t + ih, stroke: GRID, 'stroke-width': 1 }));
      s.appendChild(el('text', { x: X(v), y: m.t + ih + 16, 'text-anchor': 'middle', 'font-size': 11,
        fill: INK3, 'font-family': 'monospace' }, fmt(v)));
    }
    const rh = ih / rows.length;
    rows.forEach((r, i) => {
      const cy = m.t + rh * (i + .5), bh = Math.min(30, rh * .5);
      s.appendChild(el('text', { x: m.l - 10, y: cy, 'text-anchor': 'end', 'dominant-baseline': 'middle',
        'font-size': 11, fill: INK2 }, r.name));
      s.appendChild(el('line', { x1: X(r.min), y1: cy, x2: X(r.q1), y2: cy, stroke: INK2, 'stroke-width': 1.4 }));
      s.appendChild(el('line', { x1: X(r.q3), y1: cy, x2: X(r.max), y2: cy, stroke: INK2, 'stroke-width': 1.4 }));
      [r.min, r.max].forEach(v => s.appendChild(el('line', { x1: X(v), y1: cy - bh / 2.6, x2: X(v),
        y2: cy + bh / 2.6, stroke: INK2, 'stroke-width': 1.6 })));
      s.appendChild(el('rect', { x: X(r.q1), y: cy - bh / 2, width: Math.max(1, X(r.q3) - X(r.q1)), height: bh,
        fill: '#fff', stroke: ACC, 'stroke-width': 1.8 }));
      s.appendChild(el('line', { x1: X(r.med), y1: cy - bh / 2, x2: X(r.med), y2: cy + bh / 2,
        stroke: '#8a5a00', 'stroke-width': 2.6 }));
      (r.outliers || []).forEach(v => s.appendChild(el('circle', { cx: X(v), cy: cy, r: 3.6,
        fill: 'none', stroke: '#b3261e', 'stroke-width': 1.6 })));
      if (r.mean != null) s.appendChild(el('path', {
        d: `M${X(r.mean)},${cy - 4.5} L${X(r.mean) + 4.5},${cy} L${X(r.mean)},${cy + 4.5} L${X(r.mean) - 4.5},${cy} Z`,
        fill: '#1f7a3d' }));
    });
    return s;
  }


  /* ---------- レーダーチャート ---------- */
  function radar(box, o) {
    const W = o.W || 420, H = o.H || 340;
    const s = svgRoot(box, W, H, o.aria || 'レーダーチャート');
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.33;
    const axes = o.axes, n = axes.length, max = o.max || 100;
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
    for (let k = 1; k <= 4; k++) {
      const rr = R * k / 4;
      const pts = axes.map((_, i) => [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))]);
      s.appendChild(el('polygon', { points: pts.map(p => p.join(',')).join(' '),
        fill: 'none', stroke: GRID, 'stroke-width': 1 }));
    }
    axes.forEach((a, i) => {
      s.appendChild(el('line', { x1: cx, y1: cy, x2: cx + R * Math.cos(ang(i)), y2: cy + R * Math.sin(ang(i)),
        stroke: RULE, 'stroke-width': 1 }));
      const lx = cx + (R + 22) * Math.cos(ang(i)), ly = cy + (R + 16) * Math.sin(ang(i));
      s.appendChild(el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 11, fill: INK2 }, a));
    });
    (o.series || []).forEach((se, si) => {
      const col = se.color || PALETTE[si % PALETTE.length];
      const pts = se.values.map((v, i) => {
        const rr = R * Math.max(0, Math.min(1, v / max));
        return [cx + rr * Math.cos(ang(i)), cy + rr * Math.sin(ang(i))];
      });
      s.appendChild(el('polygon', { points: pts.map(p => p.join(',')).join(' '),
        fill: col, 'fill-opacity': .13, stroke: col, 'stroke-width': 2.2 }));
      pts.forEach(p => s.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.2, fill: col })));
    });
    (o.series || []).forEach((se, si) => {
      if (!se.name) return;
      s.appendChild(el('rect', { x: 12, y: 14 + si * 18, width: 11, height: 11,
        fill: se.color || PALETTE[si % PALETTE.length] }));
      s.appendChild(el('text', { x: 29, y: 20 + si * 18, 'dominant-baseline': 'middle',
        'font-size': 11, fill: INK2 }, se.name));
    });
    return s;
  }

  global.Chart = { bar, line, pie, scatter, hist, box5, radar, PALETTE, fmt };
})(window);
