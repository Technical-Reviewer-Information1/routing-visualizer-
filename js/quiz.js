/* 選択問題・○×判定・並べかえの共通部品。
   Quiz.choice(boxId, noteId, items, tail)  items: [{k,q,ch:[],a,why}]（aは "A|B" で複数正解）
   Quiz.judge(boxId, noteId, items, tail)   items: [{k,t,ok,why}]
   Quiz.order(boxId, noteId, cards, answer, opts) cards:[{k,t}] answer:"BACD"           */
(function (global) {
  'use strict';
  const $ = id => document.getElementById(id);

  function choice(boxId, noteId, items, tail) {
    const box = $(boxId), ans = {};
    box.innerHTML = items.map(function (b, i) {
      const long = b.ch.some(c => c.replace(/<[^>]+>/g, '').length > 14);
      return '<div' + (i ? ' style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)"' : '') + '>' +
        '<p class="pq">' + (b.k ? '【' + b.k + '】　' : '') + b.q + '</p>' +
        '<div class="choice4' + (long ? ' v' : '') + '" data-i="' + i + '">' + b.ch.map(function (c, j) {
          return '<button class="btn" data-i="' + i + '" data-c="' + j + '" style="text-align:' + (long ? 'left' : 'center') + '">' +
            '⓪①②③④⑤⑥⑦⑧⑨ⓐⓑⓒ'[j] + '　' + c + '</button>';
        }).join('') + '</div><div class="note" id="' + boxId + 'fb' + i + '" hidden></div></div>';
    }).join('');
    box.querySelectorAll('button[data-c]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = +btn.dataset.i, b = items[i], pick = +btn.dataset.c;
        const rights = String(b.a).split('|').map(Number);
        const ok = rights.indexOf(pick) >= 0;
        const row = box.querySelector('.choice4[data-i="' + i + '"]');
        row.classList.add('locked');
        [...row.children].forEach(function (x) {
          if (rights.indexOf(+x.dataset.c) >= 0) x.classList.add('correct');
          else if (x === btn) x.classList.add('wrong');
        });
        const fb = $(boxId + 'fb' + i);
        fb.hidden = false; fb.className = 'note ' + (ok ? 'ok' : 'ng');
        fb.innerHTML = (ok ? '正解。' : '正解は <strong>' + rights.map(r => '⓪①②③④⑤⑥⑦⑧⑨ⓐⓑⓒ'[r]).join('・') + '</strong>。') + b.why;
        ans[i] = ok;
        const done = Object.keys(ans).length, right = Object.values(ans).filter(Boolean).length;
        const n = $(noteId);
        n.className = 'note ' + (done === items.length ? (right === done ? 'ok' : 'warn') : 'info');
        n.innerHTML = done + ' / ' + items.length + ' 問（正解 ' + right + ' 問）' + (done === items.length && tail ? '<br>' + tail : '');
      });
    });
    $(noteId).className = 'note info';
    $(noteId).textContent = '0 / ' + items.length + ' 問';
  }

  function judge(boxId, noteId, items, tail) {
    const box = $(boxId), ans = {};
    box.innerHTML = '<div class="abcde">' + items.map(function (j, i) {
      return '<div><div class="st"><span class="k">' + (j.k || (i + 1)) + '</span><span class="t">' + j.t + '</span>' +
        '<span class="jb" data-i="' + i + '"><button class="btn" data-i="' + i + '" data-v="1">○</button>' +
        '<button class="btn" data-i="' + i + '" data-v="0">×</button></span></div>' +
        '<div class="note" id="' + boxId + 'jfb' + i + '" hidden style="margin-top:8px"></div></div>';
    }).join('') + '</div>';
    box.querySelectorAll('button[data-v]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const i = +btn.dataset.i, j = items[i], ok = (btn.dataset.v === '1') === j.ok;
        const row = box.querySelector('.jb[data-i="' + i + '"]');
        row.style.pointerEvents = 'none';
        [...row.children].forEach(function (x) {
          if ((x.dataset.v === '1') === j.ok) x.classList.add('correct'); else if (x === btn) x.classList.add('wrong');
        });
        const fb = $(boxId + 'jfb' + i);
        fb.hidden = false; fb.className = 'note ' + (ok ? 'ok' : 'ng');
        fb.innerHTML = '<strong>' + (j.ok ? '正しい記述です。' : '誤りです。') + '</strong>' + j.why;
        ans[i] = ok;
        const done = Object.keys(ans).length, right = Object.values(ans).filter(Boolean).length;
        const n = $(noteId);
        n.className = 'note ' + (done === items.length ? (right === done ? 'ok' : 'warn') : 'info');
        n.innerHTML = done + ' / ' + items.length + ' 判定（正解 ' + right + ' 問）' + (done === items.length && tail ? '<br>' + tail : '');
      });
    });
    $(noteId).className = 'note info';
    $(noteId).textContent = '0 / ' + items.length + ' 判定';
  }

  function order(boxId, noteId, cards, answer, opts) {
    opts = opts || {};
    const box = $(boxId);
    let placed = [];
    function draw() {
      box.innerHTML =
        '<div class="prep">' + answer.split('').map(function (_, i) {
          const c = placed[i];
          return '<div class="slot' + (c ? ' filled' : '') + '">' +
            '<span class="tag">' + ((opts.tags && opts.tags[i]) || (i + 1) + '番目') + '</span>' +
            (c ? '<span class="txt"><strong>' + c.k + '</strong>　' + c.t + '</span>'
               : '<span class="txt" style="color:var(--ink-3)">' + ((opts.hints && opts.hints[i]) || '？') + '</span>') + '</div>';
        }).join('') + '</div>' +
        '<div class="cards">' + cards.map(function (c) {
          return '<button class="c' + (placed.indexOf(c) >= 0 ? ' used' : '') + '" data-k="' + c.k + '"><strong>' + c.k + '</strong>　' + c.t + '</button>';
        }).join('') + '</div>' +
        '<div class="btn-row" style="margin-top:10px"><button class="btn" data-act="undo">1つ戻す</button>' +
        '<button class="btn" data-act="reset">やり直す</button></div>';
      box.querySelectorAll('button[data-k]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (placed.length >= answer.length) return;
          placed.push(cards.find(c => c.k === b.dataset.k)); draw();
        });
      });
      box.querySelector('[data-act=undo]').addEventListener('click', function () { placed.pop(); draw(); });
      box.querySelector('[data-act=reset]').addEventListener('click', function () { placed = []; draw(); });
      const n = $(noteId);
      if (placed.length < answer.length) {
        n.className = 'note info';
        n.innerHTML = placed.length + ' / ' + answer.length + ' 枚。' + ((opts.step && opts.step[placed.length]) || '');
        return;
      }
      const got = placed.map(c => c.k).join('');
      const ok = got === answer;
      n.className = 'note ' + (ok ? 'ok' : 'ng');
      n.innerHTML = 'あなたの並び：<strong>' + placed.map(c => c.k).join('→') + '</strong><br>' +
        (ok ? '正解です。' : '正しい並びは <strong>' + answer.split('').join('→') + '</strong> です。') + (opts.why || '');
    }
    draw();
  }

  global.Quiz = { choice: choice, judge: judge, order: order };
})(window);
