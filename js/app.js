(function () {
  'use strict';
  const T = window.Tools, $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  function el(n, a, t) { const e = document.createElementNS(NS, n); for (const k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; }

  /* ネットワーク構成：ルータがどのネットワークに接しているか */
  const NETS = { 1: { x: 300, y: 80 }, 2: { x: 560, y: 80 }, 3: { x: 110, y: 250 }, 4: { x: 400, y: 336 }, 5: { x: 600, y: 336 } };
  const ROUTERS = {
    'ルータ1': { nets: [3, 4], x: 250, y: 330, ifs: { 3: 'E0', 4: 'E1' } },
    'ルータ2': { nets: [1, 2], x: 430, y: 80, me: true, ifs: { 1: 'E0', 2: 'E1' } },
    'ルータ3': { nets: [2, 5], x: 600, y: 200, ifs: { 2: 'E0', 5: 'E1' } },
    'ルータ4': { nets: [1, 3], x: 150, y: 130, ifs: { 1: 'E0', 3: 'E1' } }
  };
  const ME = 'ルータ2';
  const DOWN = {};   /* 故障中のルータ */

  /** ルータ2から見た宛先ネットワークへの経路（幅優先探索でいちばん近い道をさがす）
      メトリックは本文の表に合わせて「パケットが通るルータの台数（自分を1台目と数える）」 */
  function routeTo(dest) {
    const me = ROUTERS[ME];
    if (me.nets.indexOf(dest) >= 0)
      return { iface: me.ifs[dest], gw: '直接', metric: 1, hops: [ME, 'ネットワーク' + dest] };
    const seen = {}; seen[ME] = true;
    let frontier = [{ r: ME, path: [ME], gw: null, firstNet: null }];
    while (frontier.length) {
      const next = [];
      for (const st of frontier) {
        const cur = ROUTERS[st.r];
        for (const net of cur.nets) {
          for (const rn in ROUTERS) {
            if (rn === st.r || DOWN[rn] || seen[rn]) continue;
            const r = ROUTERS[rn];
            if (r.nets.indexOf(net) < 0) continue;
            const path = st.path.concat(['ネットワーク' + net, rn]);
            const gw = st.gw || rn;
            const firstNet = st.firstNet || net;
            if (r.nets.indexOf(dest) >= 0)
              return { iface: me.ifs[firstNet], gw: gw,
                       metric: path.filter(function (x) { return x.indexOf('ルータ') === 0; }).length,
                       hops: path.concat(['ネットワーク' + dest]) };
            seen[rn] = true;
            next.push({ r: rn, path: path, gw: gw, firstNet: firstNet });
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  function reportDown() {
    if (!$('downNote')) return;
    const downs = Object.keys(DOWN).filter(function (k) { return DOWN[k]; });
    document.querySelectorAll('[data-down]').forEach(function (b) {
      const on = !!DOWN[b.dataset.down];
      b.textContent = (on ? '● ' : '') + b.dataset.down + (on ? 'は故障中（押すと復旧）' : 'を止める');
      b.classList.toggle('primary', on);
    });
    const lost = [1, 2, 3, 4, 5].filter(function (d) { return !routeTo(d); });
    const n = $('downNote');
    if (!downs.length) {
      n.className = 'note info';
      n.innerHTML = 'いまはすべて正常です。ボタンでルータを止めてみましょう。';
      return;
    }
    n.className = 'note ' + (lost.length ? 'ng' : 'ok');
    n.innerHTML = '<strong>故障中：' + downs.join('・') + '</strong><br>' +
      (lost.length
        ? 'ルータ2から <strong>ネットワーク' + lost.join('・') + '</strong> へ届かなくなりました。' +
          'ルーティングテーブルからその行が消えています。<br>' +
          '<span class="small">経路が1本しかないところは、そのルータが止まると通信できません。これを避けるために、実際のネットワークでは<strong>経路を二重にする（冗長化）</strong>ことがあります。</span>'
        : 'それでもすべてのネットワークに届きます。<strong>別の道が残っている</strong>ためです。');
  }

  /* ---------- 図 ---------- */
  let hotDest = null;
  function drawNet() {
    const W = 660, H = 400;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'ネットワーク構成図' });
    const rt = hotDest ? routeTo(hotDest) : null;
    const hotNets = rt ? rt.hops.filter(h => h.startsWith('ネット')).map(h => +h.replace('ネットワーク', '')) : [];
    const hotRouters = rt ? rt.hops.filter(h => h.startsWith('ルータ')) : [];
    // リンク
    Object.keys(ROUTERS).forEach(rn => {
      const r = ROUTERS[rn];
      r.nets.forEach(n => {
        const nn = NETS[n];
        const hot = rt && hotRouters.indexOf(rn) >= 0 && hotNets.indexOf(n) >= 0;
        svg.appendChild(el('line', { x1: r.x, y1: r.y, x2: nn.x, y2: nn.y,
          class: 'lk' + (hot ? ' hot' : ''), opacity: DOWN[rn] ? .25 : 1,
          'stroke-dasharray': DOWN[rn] ? '4 4' : null }));
      });
    });
    // ネットワーク
    Object.keys(NETS).forEach(n => {
      const p = NETS[n];
      svg.appendChild(el('ellipse', { cx: p.x, cy: p.y, rx: 62, ry: 27,
        class: 'cloud' + (hotNets.indexOf(+n) >= 0 ? ' hot' : '') }));
      svg.appendChild(el('text', { x: p.x, y: p.y + 4, class: 'lab' }, 'ネットワーク' + n));
    });
    // ルータ
    Object.keys(ROUTERS).forEach(rn => {
      const r = ROUTERS[rn];
      if (DOWN[rn]) svg.appendChild(el('rect', { x: r.x - 38, y: r.y - 20, width: 76, height: 40, rx: 4,
        fill: 'none', stroke: '#c0392b', 'stroke-width': 2.5, 'stroke-dasharray': '5 3' }));
      svg.appendChild(el('rect', { x: r.x - 34, y: r.y - 16, width: 68, height: 32, rx: 3,
        class: 'rt' + (r.me ? ' me' : '') + (hotRouters.indexOf(rn) >= 0 && !r.me ? ' hot' : '') }));
      svg.appendChild(el('text', { x: r.x, y: r.y + 4, class: 'lab' + (r.me ? ' w' : '') }, rn));
      if (r.ifs) Object.keys(r.ifs).forEach(n => {
        const nn = NETS[n];
        const mx = r.x + (nn.x - r.x) * 0.42, my = r.y + (nn.y - r.y) * 0.42;
        const dx = Math.abs(nn.x - r.x) > Math.abs(nn.y - r.y) ? 0 : 13;
        const dy = dx ? 4 : -7;
        svg.appendChild(el('text', { x: mx + dx, y: my + dy, class: 'iflab',
          'text-anchor': dx ? 'start' : 'middle' }, r.ifs[n]));
      });
    });
    const box = $('netBox'); box.innerHTML = ''; box.appendChild(svg);

    $('adjTable').innerHTML = '<thead><tr><th>ルータ</th><th>接しているネットワーク</th></tr></thead><tbody>' +
      Object.keys(ROUTERS).map(rn => '<tr><td>' + rn + (ROUTERS[rn].me ? '（自分）' : '') + '</td><td>' +
        ROUTERS[rn].nets.map(n => 'ネットワーク' + n).join('、') + '</td></tr>').join('') + '</tbody>';
  }

  /* ---------- STEP2 表 ---------- */
  const IFACES = ['E0', 'E1'];
  const GWS = ['直接', 'ルータ1', 'ルータ3', 'ルータ4'];
  const METS = ['1', '2', '3', '4'];
  function drawRt() {
    let h = '<thead><tr><th>経路</th><th>宛先ネットワーク</th><th>インタフェース</th><th>ゲートウェイ</th><th>メトリック</th></tr></thead><tbody>';
    for (let n = 1; n <= 5; n++) {
      const r = routeTo(n);
      const fixed = n <= 3;
      h += '<tr class="' + (fixed ? 'fixed' : '') + '"><td>' + n + '</td><td>ネットワーク' + n + '</td>';
      if (fixed) h += r
        ? '<td>' + r.iface + '</td><td>' + r.gw + '</td><td>' + r.metric + '</td>'
        : '<td colspan="3" style="color:#c0392b">経路なし（この行は消えます）</td>';
      else {
        h += '<td>' + sel('if' + n, IFACES) + '</td><td>' + sel('gw' + n, GWS) + '</td><td>' + sel('mt' + n, METS) + '</td>';
      }
      h += '</tr>';
    }
    $('rtTable').innerHTML = h + '</tbody>';
  }
  function sel(id, opts) {
    return '<select id="' + id + '" aria-label="' + id + '"><option value="">？</option>' +
      opts.map(o => '<option value="' + o + '">' + o + '</option>').join('') + '</select>';
  }
  function checkRt() {
    let ok = 0, tot = 0;
    [4, 5].forEach(n => {
      const r = routeTo(n);
      [['if' + n, r.iface], ['gw' + n, r.gw], ['mt' + n, String(r.metric)]].forEach(([id, ans]) => {
        tot++;
        const s = $(id);
        if (s.value === ans) { s.classList.add('ok'); s.classList.remove('ng'); ok++; }
        else { s.classList.add('ng'); s.classList.remove('ok'); }
      });
    });
    const fb = $('rtFb'); fb.hidden = false;
    fb.className = 'note ' + (ok === tot ? 'ok' : 'ng');
    fb.innerHTML = ok === tot
      ? '<strong>すべて正解です。</strong>ネットワーク4は E0 → ルータ4 でメトリック3、ネットワーク5は E1 → ルータ3 でメトリック2。'
      : ok + ' / ' + tot + ' 正解。「考え方を見る」を押すと、順を追って確かめられます。';
  }
  function hintRt() {
    const fb = $('rtFb'); fb.hidden = false; fb.className = 'note info';
    fb.innerHTML =
      '<strong>ネットワーク4へ行くには？</strong><br>' +
      'ネットワーク4に接しているのは <strong>ルータ1</strong>。でもルータ1はネットワーク3にいて、' +
      '<strong>ルータ2のとなりではありません</strong>。<br>' +
      'ルータ2 →〈ネットワーク1〉→ ルータ4 →〈ネットワーク3〉→ ルータ1 →〈ネットワーク4〉<br>' +
      '→ 出口はネットワーク1側の <strong>E0</strong>、<strong>次に渡す相手（ゲートウェイ）はルータ4</strong>。' +
      'ゲートウェイは<strong>「最終的に届けてくれるルータ」ではなく「すぐ次に渡すルータ」</strong>です。<br>' +
      '→ 通るルータは ルータ2・ルータ4・ルータ1 の <strong>3</strong> 台。<br><br>' +
      '<strong>ネットワーク5へ行くには？</strong><br>' +
      'ネットワーク5に接しているのは <strong>ルータ3</strong>。ルータ3はネットワーク2にもいて、こちらは<strong>となり</strong>です。<br>' +
      'ルータ2はネットワーク2に <span class="mono">E1</span> でつながっている。<br>' +
      '→ <strong>E1・ルータ3・2</strong>（ルータ2とルータ3の2台）。';
  }

  /* ---------- STEP3 経路追跡 ---------- */
  function showRoute(dest) {
    hotDest = dest;
    document.querySelectorAll('[data-dest]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.dest === dest));
    const r = routeTo(dest);
    drawNet();
    const n = $('routeNote');
    if (!r) {
      n.className = 'note ng';
      n.innerHTML = '<strong>ネットワーク' + dest + '</strong> へは<strong>届きません</strong>。' +
        '経路の途中にあるルータが故障しているため、ルーティングテーブルにこの宛先の行がありません。' +
        '<br><span class="small">行き先の分からないパケットは、そこで捨てられます。</span>';
      $('hopTable').innerHTML = '<thead><tr><th>順番</th><th>通る場所</th></tr></thead><tbody>' +
        '<tr><td>1</td><td>ルータ2（ここで行き先が分からず、パケットは破棄）</td></tr></tbody>';
      return;
    }
    n.className = 'note ok';
    n.innerHTML = '<strong>ネットワーク' + dest + '</strong> あてのパケットは、' +
      (r.gw === '直接'
        ? 'ルータ2の <span class="mono">' + r.iface + '</span> から出て<strong>直接</strong>届きます（メトリック ' + r.metric + '）。'
        : 'ルータ2の <span class="mono">' + r.iface + '</span> から出て <strong>' + r.gw +
          '</strong> に渡され、そこからネットワーク' + dest + 'へ届きます（メトリック ' + r.metric + '）。');
    $('hopTable').innerHTML = '<thead><tr><th>順番</th><th>通る場所</th></tr></thead><tbody>' +
      r.hops.map((h, i) => '<tr><td>' + (i + 1) + '</td><td>' + h + '</td></tr>').join('') + '</tbody>';
  }

  /* ---------- STEP4 クイズ ---------- */
  const QUIZ = [
    { t: 'ルーティングテーブルの「ゲートウェイ」が「直接」となるのはどんなときか。',
      choices: ['そのネットワークに自分が直接つながっているとき', '経由するルータが1台のとき',
                'メトリックが2のとき', '宛先が同じルータのとき'],
      a: 'そのネットワークに自分が直接つながっているとき',
      why: '自分の口（インタフェース）がそのネットワークに接していれば、他のルータに渡す必要がありません。' },
    { t: 'ルータ2からネットワーク4へ送るときのゲートウェイはどれか。',
      choices: ['ルータ1', 'ルータ3', 'ルータ4', '直接'], a: 'ルータ4',
      why: 'ネットワーク4に接しているのはルータ1ですが、<strong>ルータ1はルータ2のとなりにいません</strong>。' +
           'ルータ2のとなりはルータ4なので、まずルータ4に渡します。ゲートウェイは「すぐ次に渡す相手」です。' },
    { t: 'ルータ2からネットワーク5へ送るときのインタフェースはどれか。',
      choices: ['E1', 'E0', '直接', 'ルータ3'], a: 'E1',
      why: 'ネットワーク5に接するルータ3は、ネットワーク2にもいます。ルータ2はネットワーク2にE1でつながっています。' },
    { t: 'メトリックとは何を表すか。',
      choices: ['経由するルータの数（経路のコスト）', '通信速度', 'IPアドレスの個数', 'ケーブルの長さ'],
      a: '経由するルータの数（経路のコスト）',
      why: 'この問題ではルータの数です。実際のネットワークでは回線の速さなどを使うこともあります。' },
    { t: '同じ宛先へ2つの経路があるとき、ルータはどちらを選ぶか。',
      choices: ['メトリックが小さいほう', 'メトリックが大きいほう', '先に登録したほう', 'ランダムに選ぶ'],
      a: 'メトリックが小さいほう',
      why: 'メトリックはコストなので、小さいほうが効率のよい経路です。' },
    { t: 'ルータの役割として正しいものはどれか。',
      choices: ['異なるネットワークどうしをつなぎ、最適な経路を選んでパケットを中継する',
                '同じLAN内の端末をつなぎ通信を中継する', 'IPアドレスを自動的に割り当てる',
                'ドメイン名をIPアドレスに変換する'],
      a: '異なるネットワークどうしをつなぎ、最適な経路を選んでパケットを中継する',
      why: '2つ目はスイッチングハブ、3つ目はDHCP、4つ目はDNSの説明です。' }
  ];
  let qList = [], qi = 0, qScore = 0;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function startQuiz() { qList = shuffle(QUIZ); qi = 0; qScore = 0; renderQ(); }
  function renderQ() {
    if (qi >= qList.length) {
      $('qText').textContent = qScore + ' / ' + qList.length + ' 問正解';
      $('qChoices').innerHTML = ''; $('qFb').hidden = true; $('qNext').disabled = true;
      $('qProgress').textContent = qList.length + ' / ' + qList.length; return;
    }
    const it = qList[qi];
    $('qProgress').textContent = (qi + 1) + ' / ' + qList.length;
    $('qScore').textContent = qScore;
    $('qText').textContent = it.t;
    const box = $('qChoices'); box.className = 'choice4'; box.innerHTML = '';
    shuffle(it.choices).forEach(c => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = c; b.dataset.c = c;
      b.addEventListener('click', () => answerQ(c));
      box.appendChild(b);
    });
    $('qFb').hidden = true; $('qNext').disabled = true;
    $('qNext').textContent = (qi === qList.length - 1) ? '結果を見る' : '次の問題';
  }
  function answerQ(c) {
    const it = qList[qi], ok = c === it.a, box = $('qChoices');
    box.classList.add('locked');
    [...box.children].forEach(b => {
      if (b.dataset.c === it.a) b.classList.add('correct');
      else if (b.dataset.c === c) b.classList.add('wrong');
    });
    if (ok) qScore++;
    const fb = $('qFb');
    fb.className = 'note ' + (ok ? 'ok' : 'ng');
    fb.innerHTML = (ok ? '正解。' : '正解は「<strong>' + it.a + '</strong>」。') + it.why;
    fb.hidden = false;
    $('qScore').textContent = qScore; $('qNext').disabled = false;
  }

  /* 本文の問題 */
  function drawBook() {
    if (!document.getElementById('bookBox')) return;
    window.Quiz.choice('bookBox', 'bookNote', [{"k": "ア", "q": "ネットワーク4あての「インタフェース」は。", "ch": ["E0", "E1", "直接", "ルータ1", "ルータ3", "ルータ4", "1", "2", "3", "4"], "a": 0, "why": "ルータ2から見ると、ネットワーク4へ向かう道は<strong>ネットワーク1側</strong>に出ていきます（ネットワーク1→ルータ4→ネットワーク3→ルータ1→ネットワーク4）。ネットワーク1につながる口は <span class=\"mono\">E0</span> です。"}, {"k": "イ", "q": "ネットワーク4あての「ゲートウェイ」は。", "ch": ["E0", "E1", "直接", "ルータ1", "ルータ3", "ルータ4", "1", "2", "3", "4"], "a": 5, "why": "ネットワーク4に接しているのは<strong>ルータ1</strong>ですが、ルータ1はルータ2のとなりにいません。ゲートウェイは<strong>すぐ次に渡す相手</strong>なので、となりの<strong>ルータ4</strong>です。ここを「ルータ1」としてしまうのが定番のまちがいです。"}, {"k": "ウ", "q": "ネットワーク4あての「メトリック」は。", "ch": ["E0", "E1", "直接", "ルータ1", "ルータ3", "ルータ4", "1", "2", "3", "4"], "a": 8, "why": "ルータ2 → ルータ4 → ルータ1 と<strong>3台</strong>のルータを通ります。表の3行目（ネットワーク3）が「ルータ4・2」であることと見比べると、1台増えて3になると分かります。"}, {"k": "エ", "q": "ネットワーク5あての「インタフェース」は。", "ch": ["E0", "E1", "直接", "ルータ1", "ルータ3", "ルータ4", "1", "2", "3", "4"], "a": 1, "why": "ネットワーク5に接しているのはルータ3。ルータ3はネットワーク2にもいるので、ネットワーク2につながる <span class=\"mono\">E1</span> から出します。"}, {"k": "オ", "q": "ネットワーク5あての「ゲートウェイ」は。", "ch": ["E0", "E1", "直接", "ルータ1", "ルータ3", "ルータ4", "1", "2", "3", "4"], "a": 4, "why": "ルータ3はルータ2のとなり（ネットワーク2でつながっている）なので、そのままルータ3に渡します。"}, {"k": "カ", "q": "ネットワーク5あての「メトリック」は。", "ch": ["E0", "E1", "直接", "ルータ1", "ルータ3", "ルータ4", "1", "2", "3", "4"], "a": 7, "why": "ルータ2 → ルータ3 の<strong>2台</strong>です。ネットワーク4（3台）と比べてみましょう。"}], "本文の答えは【ア】⓪　【イ】⑤　【ウ】⑧　【エ】①　【オ】④　【カ】⑦ です。STEP 2 の答え合わせと同じ内容です。");
  }

  function init() {
    $('checkRt').addEventListener('click', checkRt);
    $('hintRt').addEventListener('click', hintRt);
    $('resetRt').addEventListener('click', () => { drawRt(); $('rtFb').hidden = true; });
    document.querySelectorAll('[data-dest]').forEach(b => b.addEventListener('click', () => showRoute(+b.dataset.dest)));
    document.querySelectorAll('[data-down]').forEach(function (b) {
      b.addEventListener('click', function () {
        const rn = b.dataset.down;
        DOWN[rn] = !DOWN[rn];
        drawNet(); drawRt(); showRoute(hotDest || 4); reportDown();
      });
    });
    if ($('upAll')) $('upAll').addEventListener('click', function () {
      Object.keys(DOWN).forEach(function (k) { delete DOWN[k]; });
      drawNet(); drawRt(); showRoute(hotDest || 4); reportDown();
    });
    reportDown();
    $('qNext').addEventListener('click', () => { qi++; renderQ(); });
    $('qReset').addEventListener('click', startQuiz);
    window.Terms.glossary($('glossBox'), ['ルータ', 'ルーティングテーブル', 'メトリック', 'パケット', 'IPアドレス', 'スイッチングハブ', 'DHCP', 'DNS']);
    drawNet(); drawRt(); showRoute(4); startQuiz();
    drawBook();
    window.Terms.attach();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
