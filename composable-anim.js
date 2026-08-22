/* Animated version of the closing figure.
 *
 * Five independently trained agents drift in, assemble into one team, the
 * camera zooms into a single piece, and that piece unfolds into the three
 * interfaces -- which then fly down and hand off to the real component boxes
 * on the page.
 *
 * Built as inline SVG driven by the Web Animations API: it stays sharp at any
 * size, needs no library, and can be cancelled and replayed cleanly. The
 * static PNG remains in the DOM as the fallback for reduced-motion, for
 * browsers without WAAPI, and for anything that runs with JS off.
 */
(function () {
  'use strict';

  var C = {                       // sampled from the figure itself
    blue: '#67a0f3', green: '#9cbf50', purple: '#ad7ad1',
    orange: '#fdab33', coral: '#fc8e96', ink: '#383c5d',
    paper: '#f7f4f2', white: '#ffffff'
  };
  var S = 140;                    // puzzle piece size
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- puzzle geometry ----------
     Each side runs 38% flat, a semicircular knob over the middle 24%, then
     38% flat. tab = +1 pushes the knob outward, -1 cuts it inward, 0 is a
     straight edge. Neighbouring pieces get opposite signs so they interlock. */
  function side(len, dx, dy, tab) {
    if (!tab) return 'l ' + dx * len + ' ' + dy * len;
    var a = 0.38 * len, k = 0.24 * len, r = 0.12 * len;
    // Walking each side in order, an outward knob always veers left, which is
    // sweep 0 in SVG's y-down coordinates -- on every side, not just the first
    // two. Passing a per-side sweep inverted the bottom and left edges, so a
    // tab and its neighbour's blank both cut inward and left a hole.
    var sw = tab > 0 ? 0 : 1;
    return 'l ' + dx * a + ' ' + dy * a + ' ' +
           'a ' + r + ' ' + r + ' 0 0 ' + sw + ' ' + dx * k + ' ' + dy * k + ' ' +
           'l ' + dx * a + ' ' + dy * a;
  }
  // edges: [top, right, bottom, left]
  function piecePath(s, e) {
    return 'M 0 0 ' +
      side(s, 1, 0, e[0]) +        // top,    knob points up
      side(s, 0, 1, e[1]) +        // right,  knob points right
      side(s, -1, 0, e[2]) +       // bottom, knob points down
      side(s, 0, -1, e[3]) +       // left,   knob points left
      ' Z';
  }

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* a small robot face, drawn at the centre of a piece */
  function robot(g, cx, cy, ink) {
    el('line', { x1: cx, y1: cy - 34, x2: cx, y2: cy - 24, stroke: ink,
                 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: cx, cy: cy - 37, r: 3.4, fill: ink }, g);
    el('rect', { x: cx - 22, y: cy - 24, width: 44, height: 36, rx: 9,
                 fill: '#fff', stroke: ink, 'stroke-width': 2.4 }, g);
    el('circle', { cx: cx - 8, cy: cy - 8, r: 3.2, fill: ink }, g);
    el('circle', { cx: cx + 8, cy: cy - 8, r: 3.2, fill: ink }, g);
    el('path', { d: 'M ' + (cx - 8) + ' ' + (cy + 2) + ' q 8 7 16 0',
                 fill: 'none', stroke: ink, 'stroke-width': 2.2,
                 'stroke-linecap': 'round' }, g);
  }

  /* ---------- the scene ---------- */
  // grid slot -> [edges, colour, letter]; the centre-bottom slot is the team
  var SLOTS = [
    { col: 0, row: 0, e: [0, 1, -1, 0], c: C.blue,   t: 'A' },
    { col: 1, row: 0, e: [0, -1, 1, -1], c: C.green,  t: 'B' },
    { col: 2, row: 0, e: [0, 0, -1, 1], c: C.purple, t: 'C' },
    { col: 0, row: 1, e: [1, -1, 0, 0], c: C.orange, t: 'D' },
    { col: 2, row: 1, e: [1, 0, 0, -1], c: C.coral,  t: 'E' }
  ];
  var TEAM = { col: 1, row: 1, e: [-1, 1, 0, 1] };
  // where each piece starts, scattered on the left
  var START = [
    { x: 40,  y: 20,  r: -14 }, { x: 300, y: 4,   r: 11 },
    { x: 690, y: 30,  r: 8 },   { x: 250, y: 268, r: -7 },
    { x: 700, y: 250, r: 15 }
  ];
  var GX = 74, GY = 62;                       // grid origin
  var ZX = 706, ZY = 96, ZK = 1.5;            // where agent A is examined

  function build(host) {
    var svg = el('svg', {
      viewBox: '0 0 990 410', class: 'canim-svg',
      role: 'img', 'aria-label':
        'Independently trained agents assembling into a coordinated team, ' +
        'then one agent unfolding into its incoming interface, training, ' +
        'and outgoing interface.'
    });
    var scene = el('g', { class: 'canim-scene' }, svg);

    // the assembled team piece, revealed on snap
    var team = el('g', { class: 'canim-team', opacity: '0' }, scene);
    var tp = el('path', {
      d: piecePath(S, TEAM.e), fill: C.white, stroke: '#d8d3cd',
      'stroke-width': 2, transform: 'translate(' + (GX + TEAM.col * S) +
        ',' + (GY + TEAM.row * S) + ')'
    }, team);
    var tcx = GX + TEAM.col * S + S / 2, tcy = GY + TEAM.row * S + S / 2;
    el('text', { x: tcx, y: tcy + 4, 'text-anchor': 'middle',
      class: 'canim-teamtext', fill: C.ink }, team).textContent = 'Coordinated';
    el('text', { x: tcx, y: tcy + 24, 'text-anchor': 'middle',
      class: 'canim-teamtext', fill: C.ink }, team).textContent = 'Team';
    void tp;

    var pieces = SLOTS.map(function (s, i) {
      var g = el('g', { class: 'canim-piece', 'data-i': i }, scene);
      el('path', { d: piecePath(S, s.e), fill: s.c, stroke: 'rgba(0,0,0,.13)',
                   'stroke-width': 1.5 }, g);
      robot(g, S / 2, S / 2 - 4, C.ink);
      el('text', { x: S / 2, y: S / 2 + 42, 'text-anchor': 'middle',
        class: 'canim-letter', fill: C.ink }, g).textContent = s.t;
      return g;
    });

    /* The zoom is shown the way the figure shows it: the assembled puzzle
       stays whole and a copy of agent A is drawn out of it, joined by dashed
       connectors. Scaling the camera instead made it ambiguous which piece
       was being examined. */
    var callout = el('g', { class: 'canim-callout', opacity: '0' }, svg);
    var ax = GX + SLOTS[0].col * S, ay = GY + SLOTS[0].row * S;
    var gx2 = GX + 3 * S, my = GY + S;          // right edge, vertical middle
    var link = el('path', {
      class: 'canim-link',
      d: 'M ' + (gx2 + 26) + ' ' + my + ' C ' + (gx2 + 96) + ' ' + my + ', ' +
         (ZX - 86) + ' ' + (ZY + S * ZK / 2) + ', ' + (ZX - 24) + ' ' +
         (ZY + S * ZK / 2),
      fill: 'none', stroke: C.ink, 'stroke-width': 2.2, 'stroke-dasharray': '9 8',
      opacity: .55
    }, callout);
    el('text', { x: (gx2 + ZX) / 2 + 4, y: my - 30, 'text-anchor': 'middle',
      class: 'canim-zoomlab', fill: C.ink, opacity: .75 },
      callout).textContent = 'ZOOM IN';

    var clone = el('g', { class: 'canim-clone' }, callout);
    el('path', { d: piecePath(S, SLOTS[0].e), fill: SLOTS[0].c,
                 stroke: 'rgba(0,0,0,.13)', 'stroke-width': 1.5 }, clone);
    robot(clone, S / 2, S / 2 - 4, C.ink);
    el('text', { x: S / 2, y: S / 2 + 42, 'text-anchor': 'middle',
      class: 'canim-letter', fill: C.ink }, clone).textContent = 'A';
    el('text', { x: ZX + S * ZK / 2, y: ZY + S * ZK + 40, 'text-anchor': 'middle',
      class: 'canim-agentlab', fill: C.ink }, callout).textContent = 'Agent A';

    host.appendChild(svg);
    return { svg: svg, scene: scene, pieces: pieces, team: team,
             callout: callout, clone: clone, link: link,
             from: [ax, ay] };
  }

  /* ---------- timeline ---------- */
  function run(ctx, heads, comps, done) {
    var anims = [];
    function A(node, frames, opts) {
      var a = node.animate(frames, Object.assign({ fill: 'both',
        easing: 'cubic-bezier(.22,.61,.36,1)' }, opts));
      anims.push(a);
      return a;
    }
    var T = 0;
    // 1. drift in, scattered
    ctx.pieces.forEach(function (g, i) {
      var s = START[i];
      g.style.transformBox = 'fill-box';
      A(g, [
        { transform: 'translate(' + s.x + 'px,' + (s.y + 40) + 'px) rotate(' +
            s.r + 'deg) scale(.9)', opacity: 0 },
        { transform: 'translate(' + s.x + 'px,' + s.y + 'px) rotate(' +
            s.r + 'deg) scale(1)', opacity: 1 }
      ], { duration: 620, delay: i * 110 });
    });
    T = 620 + 4 * 110 + 240;

    // 2. assemble
    ctx.pieces.forEach(function (g, i) {
      var s = START[i], sl = SLOTS[i];
      A(g, [
        { transform: 'translate(' + s.x + 'px,' + s.y + 'px) rotate(' + s.r + 'deg)' },
        { transform: 'translate(' + (GX + sl.col * S) + 'px,' +
            (GY + sl.row * S) + 'px) rotate(0deg)' }
      ], { duration: 900, delay: T + i * 90 });
    });
    T += 900 + 4 * 90;
    A(ctx.team, [{ opacity: 0 }, { opacity: 1 }], { duration: 460, delay: T });
    T += 460 + 420;

    // 3. pull a copy of agent A out of the assembled puzzle. The grid stays
    //    exactly where it is, so it is unmistakable which piece is examined.
    var from = ctx.from;
    ctx.clone.style.transformBox = 'fill-box';
    ctx.callout.style.opacity = 1;
    A(ctx.clone, [
      { transform: 'translate(' + from[0] + 'px,' + from[1] + 'px) scale(1)',
        opacity: 0 },
      { transform: 'translate(' + ZX + 'px,' + ZY + 'px) scale(' + ZK + ')',
        opacity: 1 }
    ], { duration: 950, delay: T });
    // the connector draws itself in behind the travelling piece
    var len = ctx.link.getTotalLength ? ctx.link.getTotalLength() : 600;
    ctx.link.style.strokeDasharray = '9 8';
    A(ctx.link, [{ strokeDashoffset: len, opacity: 0 },
                 { strokeDashoffset: 0, opacity: .55 }],
      { duration: 800, delay: T + 200 });
    // the puzzle recedes a little so the examined agent leads
    ctx.pieces.forEach(function (g, i) {
      A(g, [{ opacity: 1 }, { opacity: i === 0 ? 1 : .42 }],
        { duration: 620, delay: T + 260 });
    });
    A(ctx.team, [{ opacity: 1 }, { opacity: .42 }], { duration: 620, delay: T + 260 });
    T += 950 + 340;

    // 4. the real boxes rise in beside the examined agent and stay: what you
    //    watch arrive is the same thing you then click.
    if (comps) comps.classList.remove('canim-pending');
    heads.forEach(function (h, i) {
      A(h, [{ opacity: 0, transform: 'translateY(16px)' },
             { opacity: 1, transform: 'translateY(0)' }],
        { duration: 560, delay: T + i * 150 });
    });
    T += 560 + 2 * 150 + 300;

    // 5. bring the puzzle back to full strength; everything stays on screen
    ctx.pieces.forEach(function (g, i) {
      if (i === 0) return;
      A(g, [{ opacity: .42 }, { opacity: 1 }], { duration: 620, delay: T });
    });
    A(ctx.team, [{ opacity: .42 }, { opacity: 1 }], { duration: 620, delay: T });
    T += 620;

    setTimeout(done, T + 120);
    return anims;
  }

  /* ---------- wiring ---------- */
  function init() {
    var fig = document.querySelector('#future .ffig');
    if (!fig) return;
    var img = fig.querySelector('img');
    if (!img || !/composability/.test(img.getAttribute('src') || '')) return;
    if (!document.body.animate) return;                   // no WAAPI: keep the PNG
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Narrow screens keep the PNG: the scene needs width to read, and the
    // boxes stack there anyway. Bail out before hiding the image, or the
    // figure would vanish entirely.
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
    // held back until the zoom, but only once we know we can animate them:
    // with JS off or reduced motion the boxes must simply be there
    if (comps && heads.length) comps.classList.add('canim-pending');
    var live = [];
    function reset() {
      live.forEach(function (a) { a.cancel(); });
      live = [];
      ctx.svg.style.opacity = '';
      ctx.scene.style.transform = '';
      ctx.callout.style.opacity = 0;
      if (comps && heads.length) comps.classList.add('canim-pending');
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
      }, { threshold: 0.35 });
      io.observe(wrap);
    } else {
      play();
    }
    window.__canimPlay = play;                 // so the sequence can be driven in tests
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
