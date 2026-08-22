/* Animated version of the closing figure.
 *
 * Five independently trained agents drift in and lock into one team. The
 * puzzle then stays put while a copy of agent A travels down to become the
 * middle box. Its outward tab lights up -- that is what the agent sends --
 * and the Outgoing interface appears; its inward notch lights up -- what the
 * agent receives -- and the Incoming interface appears. The boxes that arrive
 * are the real ones on the page, so what you watch is what you then click.
 *
 * Inline SVG driven by the Web Animations API: sharp at any size, no library,
 * cancellable and replayable. The static PNG stays in the DOM as the fallback
 * for reduced motion, for narrow screens, and for browsers without WAAPI.
 */
(function () {
  'use strict';

  var C = {                       // sampled from the figure itself
    blue: '#67a0f3', green: '#9cbf50', purple: '#ad7ad1',
    orange: '#fdab33', coral: '#fc8e96', ink: '#383c5d'
  };
  var HL = { out: '#d97a12', in: '#7c5cc4' };   // match the two interface boxes
  var S = 112;                                  // puzzle piece size
  var VW = 990, VH = 452;                       // canvas
  var GX = (VW - 3 * S) / 2, GY = 10;           // grid origin, centred
  var ZK = 1.36;                                // how much larger the examined A is
  var ZW = S * ZK;
  var ZX = VW / 2 - ZW / 2, ZY = 250;           // A ends centred, above the boxes
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- puzzle geometry ----------
     Each side runs 38% flat, a semicircular knob over the middle 24%, then 38%
     flat. tab = +1 pushes the knob outward, -1 cuts it inward, 0 is straight.
     Walking the sides in order, an outward knob always veers left, which is
     sweep 0 in SVG's y-down coordinates. */
  function side(len, dx, dy, tab) {
    if (!tab) return 'l ' + dx * len + ' ' + dy * len;
    var a = 0.38 * len, k = 0.24 * len, r = 0.12 * len;
    return 'l ' + dx * a + ' ' + dy * a + ' ' +
           'a ' + r + ' ' + r + ' 0 0 ' + (tab > 0 ? 0 : 1) + ' ' +
           dx * k + ' ' + dy * k + ' ' + 'l ' + dx * a + ' ' + dy * a;
  }
  function piecePath(s, e) {          // e = [top, right, bottom, left]
    return 'M 0 0 ' + side(s, 1, 0, e[0]) + side(s, 0, 1, e[1]) +
           side(s, -1, 0, e[2]) + side(s, 0, -1, e[3]) + ' Z';
  }
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function robot(g, cx, cy, sc) {
    sc = sc || 1;
    var w = 34 * sc, h = 28 * sc;
    el('line', { x1: cx, y1: cy - h / 2 - 8 * sc, x2: cx, y2: cy - h / 2,
      stroke: C.ink, 'stroke-width': 2 * sc, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: cx, cy: cy - h / 2 - 10 * sc, r: 2.8 * sc, fill: C.ink }, g);
    el('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: 7 * sc,
      fill: '#fff', stroke: C.ink, 'stroke-width': 2 * sc }, g);
    el('circle', { cx: cx - 6.5 * sc, cy: cy - 2 * sc, r: 2.6 * sc, fill: C.ink }, g);
    el('circle', { cx: cx + 6.5 * sc, cy: cy - 2 * sc, r: 2.6 * sc, fill: C.ink }, g);
    el('path', { d: 'M ' + (cx - 6 * sc) + ' ' + (cy + 6 * sc) +
      ' q ' + (6 * sc) + ' ' + (5 * sc) + ' ' + (12 * sc) + ' 0',
      fill: 'none', stroke: C.ink, 'stroke-width': 1.9 * sc,
      'stroke-linecap': 'round' }, g);
  }

  /* the six grid slots; every shared seam is one tab against one blank */
  var SLOTS = [
    { col: 0, row: 0, e: [0, 1, -1, 0],  c: C.blue,   t: 'A' },
    { col: 1, row: 0, e: [0, -1, 1, -1], c: C.green,  t: 'B' },
    { col: 2, row: 0, e: [0, 0, -1, 1],  c: C.purple, t: 'C' },
    { col: 0, row: 1, e: [1, -1, 0, 0],  c: C.orange, t: 'D' },
    { col: 2, row: 1, e: [1, 0, 0, -1],  c: C.coral,  t: 'E' }
  ];
  var TEAM = { col: 1, row: 1, e: [-1, 1, 0, 1] };
  /* The examined copy of A is drawn with a notch on the left and a tab on the
     right, as in the figure: one side receives, the other sends. */
  var A_EDGES = [0, 1, 0, -1];
  var START = [
    { x: 60,  y: 24,  r: -13 }, { x: 300, y: 6,   r: 10 },
    { x: 690, y: 18,  r: 7 },   { x: 210, y: 210, r: -8 },
    { x: 700, y: 196, r: 14 }
  ];

  function build(host) {
    var svg = el('svg', { viewBox: '0 0 ' + VW + ' ' + VH, class: 'canim-svg',
      role: 'img', 'aria-label':
        'Five independently trained agents assemble into a coordinated team. ' +
        'One agent is examined: its outward tab is what it sends, its inward ' +
        'notch is what it receives.' });

    var team = el('g', { class: 'canim-team', opacity: '0' }, svg);
    el('path', { d: piecePath(S, TEAM.e), fill: '#fff', stroke: '#d8d3cd',
      'stroke-width': 1.8,
      transform: 'translate(' + (GX + TEAM.col * S) + ',' + (GY + TEAM.row * S) + ')'
    }, team);
    var tcx = GX + TEAM.col * S + S / 2, tcy = GY + TEAM.row * S + S / 2;
    el('text', { x: tcx, y: tcy + 1, 'text-anchor': 'middle',
      class: 'canim-teamtext', fill: C.ink }, team).textContent = 'Coordinated';
    el('text', { x: tcx, y: tcy + 17, 'text-anchor': 'middle',
      class: 'canim-teamtext', fill: C.ink }, team).textContent = 'Team';

    var pieces = SLOTS.map(function (s) {
      var g = el('g', { class: 'canim-piece' }, svg);
      el('path', { d: piecePath(S, s.e), fill: s.c, stroke: 'rgba(0,0,0,.13)',
        'stroke-width': 1.4 }, g);
      robot(g, S / 2, S / 2 - 3, 0.82);
      el('text', { x: S / 2, y: S / 2 + 34, 'text-anchor': 'middle',
        class: 'canim-letter', fill: C.ink }, g).textContent = s.t;
      return g;
    });

    /* the travelling copy of A, plus the trail showing where it came from */
    var callout = el('g', { class: 'canim-callout', opacity: '0' }, svg);
    var ax = GX + SLOTS[0].col * S, ay = GY + SLOTS[0].row * S;
    var link = el('path', { class: 'canim-link', fill: 'none', stroke: C.ink,
      'stroke-width': 2, 'stroke-dasharray': '7 7', opacity: '0',
      d: 'M ' + (ax + S / 2) + ' ' + (ay + S) + ' C ' + (ax + S / 2) + ' ' +
         (ay + S + 90) + ', ' + (ZX + ZW / 2) + ' ' + (ZY - 90) + ', ' +
         (ZX + ZW / 2) + ' ' + (ZY - 6) }, callout);

    var clone = el('g', { class: 'canim-clone' }, callout);
    el('path', { d: piecePath(S, A_EDGES), fill: C.blue,
      stroke: 'rgba(0,0,0,.13)', 'stroke-width': 1.4 }, clone);
    robot(clone, S / 2, S / 2 - 3, 0.82);
    el('text', { x: S / 2, y: S / 2 + 34, 'text-anchor': 'middle',
      class: 'canim-letter', fill: C.ink }, clone).textContent = 'A';

    /* the two highlights, positioned on A's tab and notch once it has landed */
    var midY = ZY + ZW / 2;
    var tabX = ZX + ZW, notchX = ZX;
    function ring(cx, col) {
      return el('circle', { cx: cx, cy: midY, r: 0.12 * ZW * 1.5,
        fill: 'none', stroke: col, 'stroke-width': 3, opacity: '0',
        class: 'canim-ring' }, callout);
    }
    var tabRing = ring(tabX, HL.out), notchRing = ring(notchX, HL.in);
    var tabLabel = el('text', { x: tabX + 30, y: midY - 24, class: 'canim-hl',
      fill: HL.out, opacity: '0' }, callout);
    tabLabel.textContent = 'what it sends';
    var notchLabel = el('text', { x: notchX - 30, y: midY - 24,
      'text-anchor': 'end', class: 'canim-hl', fill: HL.in, opacity: '0' }, callout);
    notchLabel.textContent = 'what it receives';

    var agentLab = el('text', { x: ZX + ZW / 2, y: ZY + ZW + 28,
      'text-anchor': 'middle', class: 'canim-agentlab', fill: C.ink,
      opacity: '0' }, callout);
    agentLab.textContent = 'Agent A';

    host.appendChild(svg);
    return { svg: svg, pieces: pieces, team: team, callout: callout,
             clone: clone, link: link, from: [ax, ay],
             tabRing: tabRing, notchRing: notchRing, agentLab: agentLab,
             tabLabel: tabLabel, notchLabel: notchLabel };
  }

  /* ---------- timeline ---------- */
  function run(ctx, heads, comps, done) {
    var anims = [];
    function A(node, frames, opts) {
      var a = node.animate(frames, Object.assign(
        { fill: 'both', easing: 'cubic-bezier(.22,.61,.36,1)' }, opts));
      anims.push(a);
      return a;
    }
    function reveal(head, at) {
      A(head, [{ opacity: 0, transform: 'translateY(14px)' },
               { opacity: 1, transform: 'translateY(0)' }],
        { duration: 520, delay: at });
    }
    function pulse(node, at) {
      node.style.transformBox = 'fill-box';
      node.style.transformOrigin = 'center';
      A(node, [{ transform: 'scale(.55)', opacity: 0 },
               { transform: 'scale(1)', opacity: .95, offset: .35 },
               { transform: 'scale(1.75)', opacity: 0 }],
        { duration: 900, delay: at, iterations: 2 });
    }

    var T = 0;
    // 1. five agents drift in, scattered
    ctx.pieces.forEach(function (g, i) {
      var s = START[i];
      A(g, [{ transform: 'translate(' + s.x + 'px,' + (s.y + 34) + 'px) rotate(' +
                s.r + 'deg) scale(.9)', opacity: 0 },
             { transform: 'translate(' + s.x + 'px,' + s.y + 'px) rotate(' +
                s.r + 'deg) scale(1)', opacity: 1 }],
        { duration: 600, delay: i * 105 });
    });
    T = 600 + 4 * 105 + 200;

    // 2. they lock into one team
    ctx.pieces.forEach(function (g, i) {
      var s = START[i], sl = SLOTS[i];
      A(g, [{ transform: 'translate(' + s.x + 'px,' + s.y + 'px) rotate(' + s.r + 'deg)' },
             { transform: 'translate(' + (GX + sl.col * S) + 'px,' +
                (GY + sl.row * S) + 'px) rotate(0deg)' }],
        { duration: 860, delay: T + i * 85 });
    });
    T += 860 + 4 * 85;
    A(ctx.team, [{ opacity: 0 }, { opacity: 1 }], { duration: 440, delay: T });
    // hold on the finished puzzle: the examined agent used to arrive on top of
    // the assembly, before there was anything to have assembled
    T += 440 + 900;

    // 3. a copy of A travels down and becomes the middle box
    ctx.callout.style.opacity = 1;
    ctx.clone.style.transformBox = 'fill-box';
    ctx.clone.style.transformOrigin = '0 0';
    A(ctx.clone, [
      { transform: 'translate(' + ctx.from[0] + 'px,' + ctx.from[1] + 'px) scale(1)',
        opacity: 0 },
      { transform: 'translate(' + ZX + 'px,' + ZY + 'px) scale(' + ZK + ')',
        opacity: 1 }
    ], { duration: 950, delay: T });
    A(ctx.agentLab, [{ opacity: 0 }, { opacity: 1 }],
      { duration: 420, delay: T + 520 });
    var len = ctx.link.getTotalLength ? ctx.link.getTotalLength() : 400;
    ctx.link.style.strokeDasharray = '7 7';
    A(ctx.link, [{ strokeDashoffset: len, opacity: 0 },
                 { strokeDashoffset: 0, opacity: .4 }],
      { duration: 780, delay: T + 120 });
    ctx.pieces.forEach(function (g, i) {
      A(g, [{ opacity: 1 }, { opacity: i === 0 ? 1 : .4 }],
        { duration: 560, delay: T + 240 });
    });
    A(ctx.team, [{ opacity: 1 }, { opacity: .4 }], { duration: 560, delay: T + 240 });
    T += 950 + 160;

    if (comps) comps.classList.remove('canim-pending');
    reveal(heads[1], T);                    // Train for composability
    T += 520 + 420;

    // 4. the outward tab is what the agent sends
    pulse(ctx.tabRing, T);
    ctx.tabLabel.style.transformBox = 'fill-box';
    A(ctx.tabLabel, [{ opacity: 0, transform: 'translateX(-8px)' },
                     { opacity: 1, transform: 'translateX(0)' }],
      { duration: 420, delay: T + 120 });
    T += 900;
    reveal(heads[2], T);                    // Outgoing interface
    T += 520 + 460;

    // 5. the inward notch is what it receives
    pulse(ctx.notchRing, T);
    ctx.notchLabel.style.transformBox = 'fill-box';
    A(ctx.notchLabel, [{ opacity: 0, transform: 'translateX(8px)' },
                       { opacity: 1, transform: 'translateX(0)' }],
      { duration: 420, delay: T + 120 });
    T += 900;
    reveal(heads[0], T);                    // Incoming interface
    T += 520 + 360;

    // 6. the team comes back to full strength; everything stays on screen.
    //    fill 'forwards', not 'both': with 'both' this step's first keyframe
    //    (0.4) was applied backwards from t=0, so the puzzle looked dimmed
    //    from the very first frame.
    ctx.pieces.forEach(function (g, i) {
      if (i === 0) return;
      A(g, [{ opacity: .4 }, { opacity: 1 }],
        { duration: 600, delay: T, fill: 'forwards' });
    });
    A(ctx.team, [{ opacity: .4 }, { opacity: 1 }],
      { duration: 600, delay: T, fill: 'forwards' });
    T += 600;

    setTimeout(done, T + 150);
    return anims;
  }

  /* ---------- wiring ---------- */
  function init() {
    var fig = document.querySelector('#future .ffig');
    if (!fig) return;
    var img = fig.querySelector('img');
    if (!img || !/composability/.test(img.getAttribute('src') || '')) return;
    if (!document.body.animate) return;
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // narrow screens keep the PNG: bail out before hiding it, or the figure
    // would vanish entirely
    if (window.innerWidth < 700) return;

    var wrap = document.createElement('div');
    wrap.className = 'canim';
    var stage = document.createElement('div');
    stage.className = 'canim-stage';
    wrap.appendChild(stage);
    var ctx = build(stage);

    var replay = document.createElement('button');
    replay.className = 'canim-replay';
    replay.type = 'button';
    replay.textContent = 'replay';
    replay.hidden = true;
    wrap.appendChild(replay);

    img.hidden = true;
    fig.insertBefore(wrap, fig.firstChild);

    var comps = document.querySelector('#future .comps');
    var heads = [].slice.call(document.querySelectorAll('#future .comphead'));
    if (comps && heads.length === 3) comps.classList.add('canim-pending');

    var live = [];
    function reset() {
      live.forEach(function (a) { a.cancel(); });
      live = [];
      ctx.callout.style.opacity = 0;
      if (comps && heads.length === 3) comps.classList.add('canim-pending');
    }
    function play() {
      reset();
      replay.hidden = true;
      live = run(ctx, heads, comps, function () { replay.hidden = false; });
    }
    replay.addEventListener('click', play);

    var seen = false;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !seen) { seen = true; play(); io.disconnect(); }
        });
      }, { threshold: 0.3 });
      io.observe(wrap);
    } else {
      play();
    }
    window.__canim = { play: play, ctx: ctx };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
