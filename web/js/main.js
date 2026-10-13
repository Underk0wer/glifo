/* Comportamiento de la página de inicio. Sin dependencias: todo es DOM y SVG. */
(function () {
  'use strict';

  var CONFIG = window.GLIFO_CONFIG;
  var GLYPHS = window.GLIFO_GLYPHS;
  var Morph = window.GlifoMorph;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Utilidades ──────────────────────────────────────────────────────────────

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function smooth(from, to, v) {
    var t = clamp((v - from) / (to - from), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function svg(name, cls, parent) {
    var node = document.createElementNS(SVG_NS, name);
    if (cls) node.setAttribute('class', cls);
    if (parent) parent.appendChild(node);
    return node;
  }
  function attrs(node, values) {
    for (var key in values) node.setAttribute(key, values[key]);
    return node;
  }
  function el(name, cls, text) {
    var node = document.createElement(name);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** Avisa cuando un elemento entra o sale de la pantalla, para animar solo lo que se ve. */
  function watch(target, onChange, margin) {
    if (!('IntersectionObserver' in window)) {
      onChange(true);
      return;
    }
    new IntersectionObserver(
      function (entries) {
        onChange(entries[entries.length - 1].isIntersecting);
      },
      { rootMargin: margin || '0px' },
    ).observe(target);
  }

  /**
   * Repite `step` cada `interval` ms mientras `target` esté a la vista y la pestaña activa.
   * Con `immediate`, el primer paso se da en cuanto entra en pantalla.
   */
  function loopWhileVisible(target, interval, step, immediate) {
    var timer = null;
    var stopped = false;
    function tick() {
      timer = null;
      if (stopped) return;
      if (!document.hidden) step();
      timer = setTimeout(tick, interval);
    }
    watch(target, function (visible) {
      clearTimeout(timer);
      timer = null;
      if (!visible || stopped || reduced) return;
      if (immediate) step();
      timer = setTimeout(tick, interval);
    });
    return {
      stop: function () {
        stopped = true;
        clearTimeout(timer);
      },
    };
  }

  // ── Enlaces al editor ───────────────────────────────────────────────────────

  $$('[data-app]').forEach(function (link) {
    link.href = CONFIG.appUrl;
  });
  $$('[data-year]').forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  // ── Controles con píldora deslizante ────────────────────────────────────────

  function segmented(group, attribute, onSelect) {
    var buttons = $$('button', group);
    var pill = $('.seg-pill', group);
    function place() {
      var current = buttons.filter(function (b) { return b.getAttribute(attribute) === 'true'; })[0];
      if (!current || !pill) return;
      pill.style.setProperty('--x', current.offsetLeft + 'px');
      pill.style.setProperty('--w', current.offsetWidth + 'px');
    }
    function select(button, byUser) {
      buttons.forEach(function (b) { b.setAttribute(attribute, String(b === button)); });
      place();
      onSelect(button, byUser);
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () { select(button, true); });
    });
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    place();
    return { buttons: buttons, select: select, place: place };
  }

  // Lo que también usa la pantalla de acceso.
  window.GlifoUI = { segmented: segmented, watch: watch };

  // ── Navegación ──────────────────────────────────────────────────────────────

  (function nav() {
    var bar = $('#nav');
    if (!bar) return;
    function compact() {
      bar.classList.toggle('is-compact', window.scrollY > 24);
    }
    window.addEventListener('scroll', compact, { passive: true });
    compact();

    // La píldora sigue al enlace bajo el cursor y, si no hay ninguno, al de la sección visible.
    var links = $$('.nav-links a', bar);
    var pill = $('.nav-pill', bar);
    var current = null;
    function rest(link) {
      if (!link) {
        pill.style.setProperty('--o', '0');
        return;
      }
      pill.style.setProperty('--x', link.offsetLeft + 'px');
      pill.style.setProperty('--w', link.offsetWidth + 'px');
      pill.style.setProperty('--o', '1');
    }
    links.forEach(function (link) {
      link.addEventListener('pointerenter', function () { rest(link); });
      link.addEventListener('focus', function () { rest(link); });
    });
    $('.nav-links', bar).addEventListener('pointerleave', function () { rest(current); });

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            current = links.filter(function (l) { return l.getAttribute('href') === '#' + entry.target.id; })[0] || null;
            links.forEach(function (l) { l.classList.toggle('is-current', l === current); });
            if (!$('.nav-links a:hover', bar)) rest(current);
          });
        },
        { rootMargin: '-45% 0px -50% 0px' },
      );
      // También las secciones sin enlace propio, para que al llegar a ellas no quede ninguno marcado.
      $$('main > section').forEach(function (section) { observer.observe(section); });
    }

    // Menú del móvil.
    var burger = $('.nav-burger', bar);
    var menu = $('#menu');
    var closing = null;
    function setMenu(open) {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar el menú' : 'Abrir el menú');
      clearTimeout(closing);
      if (open) {
        menu.hidden = false;
        void menu.offsetWidth;
        menu.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      } else {
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
        closing = setTimeout(function () { menu.hidden = true; }, 760);
      }
    }
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') setMenu(false);
    });
    window.matchMedia('(min-width: 1081px)').addEventListener('change', function (query) {
      if (query.matches) setMenu(false);
    });
  })();

  // ── Tema ────────────────────────────────────────────────────────────────────

  $$('.theme-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = window.GlifoTheme.current() === 'dark' ? 'light' : 'dark';
      if (!document.startViewTransition || reduced) {
        window.GlifoTheme.set(next);
        return;
      }
      var box = button.getBoundingClientRect();
      var x = box.left + box.width / 2;
      var y = box.top + box.height / 2;
      var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add('is-theming');
      var transition = document.startViewTransition(function () { window.GlifoTheme.set(next); });
      transition.ready
        .then(function () {
          root.animate(
            { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
            { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)', pseudoElement: '::view-transition-new(root)' },
          );
        })
        .catch(function () {});
      transition.finished.then(
        function () { root.classList.remove('is-theming'); },
        function () { root.classList.remove('is-theming'); },
      );
    });
  });

  // ── Titulares por palabras y aparición al entrar en pantalla ─────────────────

  (function reveal() {
    $$('[data-split]').forEach(function (heading) {
      var index = 0;
      heading.setAttribute('aria-label', heading.textContent.replace(/\s+/g, ' ').trim());
      (function split(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 1) {
            split(child);
            return;
          }
          if (child.nodeType !== 3) return;
          var fragment = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              fragment.appendChild(document.createTextNode(' '));
              return;
            }
            var word = el('span', 'w');
            var inner = el('span', '', part);
            word.setAttribute('aria-hidden', 'true');
            word.style.setProperty('--i', String(index++));
            word.appendChild(inner);
            fragment.appendChild(word);
          });
          node.replaceChild(fragment, child);
        });
      })(heading);
    });

    // Los hermanos que aparecen juntos lo hacen uno detrás de otro.
    $$('[data-reveal]').forEach(function (node) {
      var siblings = $$('[data-reveal]', node.parentNode).filter(function (other) { return other.parentNode === node.parentNode; });
      node.style.setProperty('--d', String(siblings.indexOf(node) % 4));
    });

    var targets = $$('[data-reveal], [data-split]');
    function show(node) {
      node.classList.add('is-in');
      // Pasada la entrada, el retraso sobra: estorbaría a las transiciones al pasar el cursor.
      setTimeout(function () { node.style.setProperty('--d', '0'); }, 1400);
    }
    if (!('IntersectionObserver' in window) || reduced) {
      targets.forEach(show);
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          show(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0.12 },
    );
    targets.forEach(function (node) { observer.observe(node); });
  })();

  // ── Botones ─────────────────────────────────────────────────────────────────

  $$('.btn-primary').forEach(function (button) {
    button.addEventListener('pointerenter', function (event) {
      var box = button.getBoundingClientRect();
      button.style.setProperty('--bx', event.clientX - box.left + 'px');
      button.style.setProperty('--by', event.clientY - box.top + 'px');
    });
  });

  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('[data-magnetic]').forEach(function (button) {
      button.addEventListener('pointermove', function (event) {
        var box = button.getBoundingClientRect();
        button.style.setProperty('--tx', ((event.clientX - box.left - box.width / 2) * 0.22).toFixed(1) + 'px');
        button.style.setProperty('--ty', ((event.clientY - box.top - box.height / 2) * 0.3).toFixed(1) + 'px');
      });
      button.addEventListener('pointerleave', function () {
        button.style.setProperty('--tx', '0px');
        button.style.setProperty('--ty', '0px');
      });
    });
  }

  document.addEventListener('pointermove', function (event) {
    var card = event.target.closest && event.target.closest('[data-spot]');
    if (!card) return;
    var box = card.getBoundingClientRect();
    card.style.setProperty('--mx', event.clientX - box.left + 'px');
    card.style.setProperty('--my', event.clientY - box.top + 'px');
  });

  // ── Portada: la letra que se transforma y se deja editar ─────────────────────

  (function stage() {
    var host = $('#stage');
    if (!host) return;
    var canvas = $('.stage-svg', host);
    var readout = $('.stage-readout', host);
    var hint = $('.stage-hint', host);
    var strip = $('.stage-strip', host);
    var M = GLYPHS.metrics;
    var LETTERS = ['g', 'l', 'i', 'f', 'o'];
    var HOLD = 2700;
    var DURATION = 1250;

    var defs = svg('defs', '', canvas);
    var fade = attrs(svg('linearGradient', '', defs), { id: 'stage-fade', gradientUnits: 'userSpaceOnUse', y1: 0, y2: 0 });
    var stops = [0, 0.3, 0.6, 1].map(function (offset) {
      return attrs(svg('stop', 'stage-stop', fade), { offset: offset });
    });
    var lines = [
      { label: 'Ascendente', value: M.ascender },
      { label: 'Altura x', value: M.xHeight },
      { label: 'Línea base', value: 0 },
      { label: 'Descendente', value: M.descender },
    ].map(function (metric) {
      metric.line = attrs(svg('line', 'stage-line', canvas), { stroke: 'url(#stage-fade)' });
      metric.text = attrs(svg('text', 'stage-label', canvas), { 'text-anchor': 'end' });
      metric.text.textContent = metric.label + '  ' + String(metric.value).replace('-', '−');
      return metric;
    });
    var box = svg('rect', 'stage-box', canvas);
    var sides = [svg('line', 'stage-side', canvas), svg('line', 'stage-side', canvas)];
    var group = svg('g', '', canvas);
    var shape = svg('path', 'stage-shape', group);
    var handleLayer = svg('g', 'stage-handles', canvas);
    var nodeLayer = svg('g', 'stage-nodes', canvas);

    var index = 0;
    var live = Morph.centered(GLYPHS.glyphs[LETTERS[0]]);
    var advance = GLYPHS.glyphs[LETTERS[0]].adv;
    var layout = { w: 0, h: 0, cx: 0, base: 0, s: 1 };
    var items = [];
    var morphing = false;
    var queued = null;
    var timer = null;
    var onScreen = false;
    var hovering = false;
    var dragging = null;
    var edited = false;
    var settled = 0;
    var touched = false;

    var buttons = LETTERS.map(function (letter, i) {
      var button = el('button', '', letter);
      button.type = 'button';
      button.setAttribute('aria-label', 'Mostrar la letra ' + letter);
      button.setAttribute('aria-pressed', String(i === 0));
      button.addEventListener('click', function () { go(i); });
      strip.appendChild(button);
      return button;
    });

    function px(n) {
      return [layout.cx + n[0] * layout.s, layout.base - n[1] * layout.s];
    }

    function drawBox() {
      var x0 = layout.cx - (advance / 2) * layout.s;
      var x1 = layout.cx + (advance / 2) * layout.s;
      attrs(box, { x: x0, y: layout.base - M.ascender * layout.s, width: x1 - x0, height: (M.ascender - M.descender) * layout.s });
      attrs(sides[0], { x1: x0, x2: x0, y1: 0, y2: layout.h });
      attrs(sides[1], { x1: x1, x2: x1, y1: 0, y2: layout.h });
    }

    function place() {
      items.forEach(function (item) {
        var n = live[item.c][item.k];
        var p = px(n);
        if (item.round) attrs(item.mark, { cx: p[0], cy: p[1], r: 4.2 });
        else attrs(item.mark, { x: p[0] - 3.7, y: p[1] - 3.7, width: 7.4, height: 7.4 });
        attrs(item.hit, { cx: p[0], cy: p[1], r: 13 });
        if (item.lineIn) {
          var a = px([n[2], n[3]]);
          attrs(item.lineIn, { x1: p[0], y1: p[1], x2: a[0], y2: a[1] });
          attrs(item.knobIn, { cx: a[0], cy: a[1], r: 2.6 });
        }
        if (item.lineOut) {
          var b = px([n[4], n[5]]);
          attrs(item.lineOut, { x1: p[0], y1: p[1], x2: b[0], y2: b[1] });
          attrs(item.knobOut, { cx: b[0], cy: b[1], r: 2.6 });
        }
      });
    }

    function showReadout(item) {
      var n = live[item.c][item.k];
      var p = px(n);
      readout.textContent = 'x ' + Math.round(n[0] + advance / 2) + '   y ' + Math.round(n[1]);
      readout.style.setProperty('--x', p[0].toFixed(1));
      readout.style.setProperty('--y', p[1].toFixed(1));
      readout.classList.add('is-on');
    }

    function buildNodes() {
      nodeLayer.textContent = '';
      handleLayer.textContent = '';
      items = [];
      var order = 0;
      live.forEach(function (contour, c) {
        contour.forEach(function (n, k) {
          var item = { c: c, k: k, round: !!n[6] };
          var delay = String(order++);
          if (n[2] !== null) {
            item.lineIn = svg('line', 'stage-handle', handleLayer);
            item.knobIn = svg('circle', 'stage-knob', handleLayer);
          }
          if (n[4] !== null) {
            item.lineOut = svg('line', 'stage-handle', handleLayer);
            item.knobOut = svg('circle', 'stage-knob', handleLayer);
          }
          [item.lineIn, item.knobIn, item.lineOut, item.knobOut].forEach(function (part) {
            if (part) part.style.setProperty('--i', delay);
          });
          item.g = svg('g', 'stage-node', nodeLayer);
          item.g.style.setProperty('--i', delay);
          item.mark = svg(item.round ? 'circle' : 'rect', 'stage-mark', item.g);
          item.hit = svg('circle', 'stage-hit', item.g);
          bind(item);
          items.push(item);
        });
      });
      place();
    }

    function bind(item) {
      var last = null;
      item.hit.addEventListener('pointerenter', function () {
        if (morphing) return;
        hovering = true;
        item.g.classList.add('is-hot');
        showReadout(item);
      });
      item.hit.addEventListener('pointerleave', function () {
        hovering = false;
        if (dragging !== item) {
          item.g.classList.remove('is-hot');
          readout.classList.remove('is-on');
        }
        schedule(edited ? 3200 : HOLD);
      });
      item.hit.addEventListener('pointerdown', function (event) {
        if (morphing) return;
        event.preventDefault();
        item.hit.setPointerCapture(event.pointerId);
        dragging = item;
        touched = true;
        hint.classList.remove('is-on');
        last = [event.clientX, event.clientY];
      });
      item.hit.addEventListener('pointermove', function (event) {
        if (dragging !== item) return;
        var dx = (event.clientX - last[0]) / layout.s;
        var dy = -(event.clientY - last[1]) / layout.s;
        last = [event.clientX, event.clientY];
        var n = live[item.c][item.k];
        n[0] += dx;
        n[1] += dy;
        if (n[2] !== null) { n[2] += dx; n[3] += dy; }
        if (n[4] !== null) { n[4] += dx; n[5] += dy; }
        edited = true;
        shape.setAttribute('d', Morph.pathOf(live));
        place();
        showReadout(item);
      });
      function release() {
        if (dragging !== item) return;
        dragging = null;
        if (!hovering) {
          item.g.classList.remove('is-hot');
          readout.classList.remove('is-on');
        }
        schedule(3200);
      }
      item.hit.addEventListener('pointerup', release);
      item.hit.addEventListener('pointercancel', release);
    }

    function placeHint() {
      if (touched || settled > 3 || !items.length) return;
      // El nodo más a la derecha queda lejos del titular y del resto de nodos.
      var pick = items.reduce(function (a, b) { return live[b.c][b.k][0] > live[a.c][a.k][0] ? b : a; });
      var p = px(live[pick.c][pick.k]);
      // En pantallas estrechas el rótulo no cabría a la derecha del nodo: se queda dentro.
      p[0] = Math.min(p[0], layout.w - hint.offsetWidth - 28);
      hint.style.setProperty('--x', p[0].toFixed(1));
      hint.style.setProperty('--y', p[1].toFixed(1));
      hint.classList.add('is-on');
    }

    function measure() {
      var size = host.getBoundingClientRect();
      if (!size.width || !size.height) return;
      var style = getComputedStyle(host);
      var number = function (name, fallback) {
        var value = parseFloat(style.getPropertyValue(name));
        return isNaN(value) ? fallback : value;
      };
      layout.w = size.width;
      layout.h = size.height;
      layout.s = Math.min((size.height * number('--glyph-span', 0.6)) / (M.ascender - M.descender), (size.width * number('--glyph-fit', 0.42)) / 620);
      layout.cx = size.width * number('--glyph-x', 0.7);
      layout.base = size.height * number('--glyph-base', 0.66);
      var faded = number('--fade', 1) > 0;
      attrs(canvas, { viewBox: '0 0 ' + size.width + ' ' + size.height });
      attrs(fade, { x1: 0, x2: size.width });
      stops.forEach(function (stop, i) { stop.setAttribute('stop-opacity', faded && i < 2 ? 0 : 1); });
      attrs(group, { transform: 'translate(' + layout.cx + ' ' + layout.base + ') scale(' + layout.s + ' ' + -layout.s + ')' });
      host.style.setProperty('--cx', layout.cx.toFixed(1));
      lines.forEach(function (metric) {
        var y = Math.round(layout.base - metric.value * layout.s) + 0.5;
        attrs(metric.line, { x1: 0, x2: size.width, y1: y, y2: y });
        attrs(metric.text, { x: size.width - (size.width < 700 ? 12 : 28), y: y - 8 });
      });
      drawBox();
      place();
      if (hint.classList.contains('is-on')) placeHint();
    }

    function schedule(delay) {
      clearTimeout(timer);
      if (reduced) return;
      timer = setTimeout(function () {
        if (!onScreen || document.hidden || hovering || dragging) {
          schedule(900);
          return;
        }
        go((index + 1) % LETTERS.length);
      }, delay);
    }

    function settle(target, contours) {
      live = contours;
      advance = GLYPHS.glyphs[LETTERS[target]].adv;
      index = target;
      edited = false;
      morphing = false;
      settled++;
      shape.setAttribute('d', Morph.pathOf(live));
      drawBox();
      buildNodes();
      canvas.classList.remove('is-morphing');
      placeHint();
      if (queued !== null && queued !== index) {
        var next = queued;
        queued = null;
        go(next);
        return;
      }
      queued = null;
      schedule(HOLD);
    }

    function go(target) {
      if (morphing) {
        queued = target;
        return;
      }
      if (target === index && !edited) return;
      clearTimeout(timer);
      var glyph = GLYPHS.glyphs[LETTERS[target]];
      var to = Morph.centered(glyph);
      buttons.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === target)); });
      hint.classList.remove('is-on');
      readout.classList.remove('is-on');
      if (reduced) {
        settle(target, to);
        return;
      }
      var steps = Morph.plan(live, to);
      var from = advance;
      var start = null;
      morphing = true;
      canvas.classList.add('is-morphing');
      requestAnimationFrame(function frame(now) {
        if (start === null) start = now;
        var t = clamp((now - start) / DURATION, 0, 1);
        shape.setAttribute('d', Morph.render(steps, t, 0.5));
        advance = from + (glyph.adv - from) * Morph.easeInOut(t);
        drawBox();
        if (t < 1) requestAnimationFrame(frame);
        else settle(target, to);
      });
    }

    shape.setAttribute('d', Morph.pathOf(live));
    measure();
    buildNodes();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(host);
    else window.addEventListener('resize', measure);
    watch(host, function (visible) {
      onScreen = visible;
      if (visible) {
        schedule(HOLD);
        setTimeout(placeHint, 1500);
      } else {
        clearTimeout(timer);
      }
    });
  })();

  // ── Cinta ───────────────────────────────────────────────────────────────────

  $$('.marquee-track').forEach(function (track) {
    $$('*', track)
      .filter(function (node) { return node.parentNode === track; })
      .forEach(function (node) { track.appendChild(node.cloneNode(true)); });
  });

  // ── Funciones: la letra que se dibuja sola ───────────────────────────────────

  (function draw() {
    var demo = $('[data-demo="draw"]');
    if (!demo) return;
    var canvas = $('.draw-svg', demo);
    var counter = $('.draw-count', demo);
    var SCALE = 0.46;
    var BASE = 318;
    var CENTER = 286;
    var contours = Morph.centered(GLYPHS.glyphs.a);

    [0, GLYPHS.metrics.xHeight].forEach(function (value) {
      var y = BASE - value * SCALE;
      attrs(svg('line', 'draw-metric', canvas), { x1: 0, x2: 560, y1: y, y2: y });
    });
    var group = attrs(svg('g', '', canvas), { transform: 'translate(' + CENTER + ' ' + BASE + ') scale(' + SCALE + ' ' + -SCALE + ')' });
    var fill = attrs(svg('path', 'draw-fill', group), { d: Morph.pathOf(contours) });
    var total = contours.reduce(function (sum, c) { return sum + Morph.perimeter(c); }, 0);
    var cursor = 0;
    var strokes = contours.map(function (contour) {
      var length = Morph.perimeter(contour);
      var path = attrs(svg('path', 'draw-stroke', group), { d: Morph.pathOf([contour]), pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1, 'stroke-width': 1.7 / SCALE });
      var part = { path: path, from: cursor / total, to: (cursor + length) / total, real: path.getTotalLength(), nodes: [] };
      cursor += length;
      // Cada nodo aparece cuando el trazo llega a él.
      var walked = 0;
      var pieces = Morph.lengths(contour);
      contour.forEach(function (n, k) {
        var size = 3.9 / SCALE;
        var mark = n[6]
          ? attrs(svg('circle', 'draw-node', group), { cx: n[0], cy: n[1], r: size })
          : attrs(svg('rect', 'draw-node', group), { x: n[0] - size, y: n[1] - size, width: size * 2, height: size * 2 });
        mark.setAttribute('stroke-width', 1.3 / SCALE);
        part.nodes.push({ mark: mark, at: walked / length });
        walked += pieces[k];
      });
      return part;
    });
    var pen = attrs(svg('circle', 'draw-pen', canvas), { r: 5.5 });
    var nodeCount = strokes.reduce(function (sum, part) { return sum + part.nodes.length; }, 0);

    function frame(p) {
      // 0–0,52 se traza · 0,52–0,64 se rellena · hasta 0,9 se muestra · después se desvanece.
      var drawn = Morph.easeInOut(clamp(p / 0.52, 0, 1));
      var inked = smooth(0.52, 0.64, p);
      var gone = smooth(0.9, 0.99, p);
      var visible = 0;
      var head = null;
      strokes.forEach(function (part) {
        var local = clamp((drawn - part.from) / (part.to - part.from), 0, 1);
        part.path.setAttribute('stroke-dashoffset', (1 - local).toFixed(4));
        part.nodes.forEach(function (node) {
          var on = local > 0 && local >= node.at && inked < 0.5;
          node.mark.classList.toggle('is-on', on);
          if (local > 0 && local >= node.at) visible++;
        });
        if (local > 0 && local < 1) head = part.path.getPointAtLength(local * part.real);
      });
      fill.style.opacity = String(inked);
      group.style.opacity = String(1 - gone);
      if (head) attrs(pen, { cx: CENTER + head.x * SCALE, cy: BASE - head.y * SCALE });
      pen.style.opacity = head ? '1' : '0';
      var shown = Math.min(visible, nodeCount);
      counter.textContent = shown + (shown === 1 ? ' nodo' : ' nodos');
    }

    if (reduced) {
      frame(0.75);
      return;
    }
    var CYCLE = 7600;
    var running = false;
    var origin = null;
    function tick(now) {
      if (!running) return;
      if (origin === null) origin = now;
      frame(((now - origin) % CYCLE) / CYCLE);
      requestAnimationFrame(tick);
    }
    frame(0);
    watch(demo, function (visible) {
      if (visible === running) return;
      running = visible;
      if (visible) requestAnimationFrame(tick);
    });
  })();

  // ── Funciones: unión, resta e intersección ───────────────────────────────────

  (function bool() {
    var demo = $('[data-demo="bool"]');
    if (!demo) return;
    var result = $('.bool-result', demo);
    var R = 88, D = 52, N = 56;
    var alpha = Math.atan2(Math.sqrt(R * R - D * D), D);

    function arc(centerX, from, to) {
      var points = [];
      for (var i = 0; i < N; i++) {
        var a = from + ((to - from) * i) / N;
        points.push(centerX + R * Math.cos(a), -R * Math.sin(a));
      }
      return points;
    }
    // Cada resultado son dos arcos entre los dos puntos donde se cortan los círculos, recorridos
    // en el mismo sentido: así pasar de uno a otro es mover cada arco, sin que la forma se dé la vuelta.
    var SHAPES = {
      unite: arc(-D, alpha, 2 * Math.PI - alpha).concat(arc(D, alpha - Math.PI, Math.PI - alpha)),
      subtract: arc(-D, alpha, 2 * Math.PI - alpha).concat(arc(D, Math.PI + alpha, Math.PI - alpha)),
      intersect: arc(D, Math.PI - alpha, Math.PI + alpha).concat(arc(-D, -alpha, alpha)),
    };
    var shown = SHAPES.unite.slice();

    function paint(points) {
      var d = '';
      for (var i = 0; i < points.length; i += 2) d += (i ? 'L' : 'M') + points[i].toFixed(1) + ' ' + points[i + 1].toFixed(1);
      result.setAttribute('d', d + 'Z');
    }

    var run = 0;
    function show(operation) {
      var from = shown.slice();
      var to = SHAPES[operation];
      var id = ++run;
      var start = null;
      if (reduced) {
        shown = to.slice();
        paint(shown);
        return;
      }
      requestAnimationFrame(function frame(now) {
        if (id !== run) return;
        if (start === null) start = now;
        var t = clamp((now - start) / 760, 0, 1);
        // Un pequeño rebote al llegar.
        var e = 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.6);
        for (var i = 0; i < to.length; i++) shown[i] = from[i] + (to[i] - from[i]) * e;
        paint(shown);
        if (t < 1) requestAnimationFrame(frame);
      });
    }

    paint(shown);
    var control;
    var auto = loopWhileVisible(demo, 2500, function () {
      var buttons = control.buttons;
      var current = buttons.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
      control.select(buttons[(buttons.indexOf(current) + 1) % buttons.length], false);
    });
    control = segmented($('.seg', demo), 'aria-pressed', function (button, byUser) {
      if (byUser) auto.stop();
      show(button.dataset.op);
    });
  })();

  // ── Funciones: kerning ──────────────────────────────────────────────────────

  (function kern() {
    var demo = $('[data-demo="kern"]');
    if (!demo) return;
    var word = $('.kern-word', demo);
    var input = $('input', demo);
    var output = $('output', demo);
    function apply(value) {
      word.style.setProperty('--k', String(value));
      output.textContent = (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value);
    }
    var manual = false;
    ['input', 'pointerdown', 'keydown'].forEach(function (type) {
      input.addEventListener(type, function () {
        manual = true;
        apply(Number(input.value));
      });
    });
    apply(Number(input.value));
    if (reduced) return;
    var running = false;
    var origin = null;
    function tick(now) {
      if (!running || manual) return;
      if (origin === null) origin = now;
      // Va y viene entre demasiado suelto y demasiado apretado, pasando por su sitio.
      var value = Math.round(-60 + 90 * Math.sin((now - origin) / 900));
      input.value = String(value);
      apply(value);
      requestAnimationFrame(tick);
    }
    watch(demo, function (visible) {
      if (visible === running) return;
      running = visible;
      origin = null;
      if (visible) requestAnimationFrame(tick);
    });
  })();

  // ── Funciones: acentos ──────────────────────────────────────────────────────

  (function accent() {
    var demo = $('[data-demo="accent"]');
    if (!demo) return;
    var glyph = $('.accent-glyph', demo);
    var base = $('.accent-base', demo);
    var mark = $('.accent-mark', demo);
    var formula = $$('.accent-formula b', demo);
    var LETTERS = [['á', 'a', '´'], ['é', 'e', '´'], ['í', 'i', '´'], ['ó', 'o', '´'], ['ú', 'u', '´'], ['ñ', 'n', '~']];
    var index = 0;
    // La primera vez que se ve, la «á»; después, una letra nueva en cada vuelta.
    var first = true;
    function write() {
      var letter = LETTERS[index];
      base.textContent = letter[0];
      mark.textContent = letter[0];
      formula[0].textContent = letter[1];
      formula[1].textContent = letter[2];
      formula[2].textContent = letter[0];
    }
    write();
    loopWhileVisible(
      demo,
      2600,
      function () {
        if (!first) index = (index + 1) % LETTERS.length;
        first = false;
        write();
        glyph.classList.remove('is-playing');
        void glyph.offsetWidth;
        glyph.classList.add('is-playing');
      },
      true,
    );
  })();

  // ── Funciones: familias ─────────────────────────────────────────────────────

  (function family() {
    var demo = $('[data-demo="family"]');
    if (!demo) return;
    var sample = $('.family-sample', demo);
    var control;
    var auto = loopWhileVisible(demo, 2200, function () {
      var buttons = control.buttons;
      var current = buttons.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
      control.select(buttons[(buttons.indexOf(current) + 1) % buttons.length], false);
    });
    control = segmented($('.seg', demo), 'aria-pressed', function (button, byUser) {
      if (byUser) auto.stop();
      sample.style.setProperty('--wght', button.dataset.weight);
    });
  })();

  // ── Funciones: exportar ─────────────────────────────────────────────────────

  (function exporter() {
    var demo = $('[data-demo="export"]');
    if (!demo) return;
    var pill = $('.export-pill', demo);
    var formats = $$('.formats li', demo);
    var step = 0;
    formats[0].classList.add('is-on');
    loopWhileVisible(demo, 1700, function () {
      step = (step + 1) % 3;
      if (step === 0) {
        pill.removeAttribute('data-state');
        var current = formats.filter(function (item) { return item.classList.contains('is-on'); })[0];
        var next = formats[(formats.indexOf(current) + 1) % formats.length];
        formats.forEach(function (item) { item.classList.toggle('is-on', item === next); });
      } else {
        pill.setAttribute('data-state', step === 1 ? 'busy' : 'done');
      }
    });
  })();

  // ── El editor: capturas ─────────────────────────────────────────────────────

  (function shots() {
    var host = $('[data-shots]');
    if (!host) return;
    var tabs = $('.shots-tabs', host);
    var view = $('.browser-view', host);
    var caption = $('.shots-caption', host);
    var CAPTIONS = {
      'shot-editor': 'El lienzo, con los nodos y tiradores de la letra, entre la rejilla de glifos y el panel de propiedades.',
      'shot-kerning': 'Un clic entre dos letras elige la pareja. El ajuste se suma al kerning que ya traía la fuente.',
      'shot-probar': 'La fuente ya compilada, con tus textos y comparando los estilos de la familia.',
      'shot-exportar': 'Toda la familia o un solo estilo, para instalar o para la web.',
    };
    var hideTimer = null;
    var control;
    var auto = loopWhileVisible(host, 5200, function () {
      if (host.matches(':hover')) return;
      var buttons = control.buttons;
      var current = buttons.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0];
      control.select(buttons[(buttons.indexOf(current) + 1) % buttons.length], false);
    });
    control = segmented(tabs, 'aria-selected', function (button, byUser) {
      if (byUser) auto.stop();
      control.buttons.forEach(function (b) { b.tabIndex = b === button ? 0 : -1; });
      var next = document.getElementById(button.getAttribute('aria-controls'));
      var previous = $('.shot.is-active', view);
      caption.textContent = CAPTIONS[next.id];
      if (next === previous) return;
      var area = view.getBoundingClientRect();
      var origin = button.getBoundingClientRect();
      next.style.setProperty('--ox', (((origin.left + origin.width / 2 - area.left) / area.width) * 100).toFixed(1) + '%');
      clearTimeout(hideTimer);
      $$('.shot', view).forEach(function (shot) {
        if (shot !== next && shot !== previous) shot.hidden = true;
        shot.classList.remove('is-active', 'is-entering');
      });
      next.hidden = false;
      next.classList.add('is-active');
      if (!reduced) next.classList.add('is-entering');
      hideTimer = setTimeout(function () {
        if (previous) previous.hidden = true;
        next.classList.remove('is-entering');
      }, 1000);
    });
    caption.textContent = CAPTIONS['shot-editor'];
    tabs.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      var buttons = control.buttons;
      var at = buttons.indexOf(document.activeElement);
      if (at < 0) return;
      var next = buttons[(at + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
      next.focus();
      next.click();
    });

    // La ventana llega tumbada y se endereza al subir por la pantalla.
    var frame = $('[data-tilt]', host);
    if (!frame || reduced) return;
    var pending = false;
    function tilt() {
      pending = false;
      var area = frame.parentNode.getBoundingClientRect();
      var height = window.innerHeight;
      frame.style.setProperty('--tilt', clamp((area.top - height * 0.3) / (height * 0.62), 0, 1).toFixed(3));
    }
    window.addEventListener(
      'scroll',
      function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(tilt);
      },
      { passive: true },
    );
    window.addEventListener('resize', tilt);
    tilt();
  })();

  // ── Cifras ──────────────────────────────────────────────────────────────────

  $$('[data-count]').forEach(function (node) {
    var target = Number(node.dataset.count);
    if (!target || reduced || !('IntersectionObserver' in window)) return;
    node.textContent = '0';
    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      var start = null;
      requestAnimationFrame(function frame(now) {
        if (start === null) start = now;
        var t = clamp((now - start) / 1500, 0, 1);
        node.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 4))));
        if (t < 1) requestAnimationFrame(frame);
      });
    }, { threshold: 0.6 });
    observer.observe(node);
  });

  // ── Cómo funciona: de las formas básicas a la letra, al ritmo del desplazamiento ──

  (function how() {
    var section = $('.how');
    if (!section) return;
    var canvas = $('.how-svg', section);
    var file = $('.how-file', section);
    var steps = $$('.how-step', section);
    var dots = $$('.how-dots li', section);
    var narrow = window.matchMedia('(max-width: 980px)');
    var letter = Morph.centered(GLYPHS.glyphs.b);

    // Una «b» hecha con un rectángulo y un círculo, a la medida de la letra final.
    var xs = [], ys = [];
    letter.forEach(function (contour) {
      contour.forEach(function (n) {
        xs.push(n[0]);
        ys.push(n[1]);
      });
    });
    var left = Math.min.apply(null, xs), right = Math.max.apply(null, xs), top = Math.max.apply(null, ys);
    var STEM = 86;
    var r = Math.min(252, (right - left) / 2);
    var cx = right - r, cy = r - 8;
    var edge = left + STEM;
    var reach = Math.sqrt(Math.max(r * r - (edge - cx) * (edge - cx), 0));
    var angle = Math.atan2(reach, edge - cx);
    var k = (4 / 3) * Math.tan((angle - Math.PI / 2) / 4) * r;
    var q = 0.5523 * r;
    var inner = r - STEM, qi = 0.5523 * inner;
    var simple = [
      [
        [left, 0, null, null, null, null, 0],
        [left, top, null, null, null, null, 0],
        [edge, top, null, null, null, null, 0],
        [edge, cy + reach, null, null, edge + k * Math.sin(angle), cy + reach - k * Math.cos(angle), 0],
        [cx, cy + r, cx - k, cy + r, cx + q, cy + r, 1],
        [cx + r, cy, cx + r, cy + q, cx + r, cy - q, 1],
        [cx, cy - r, cx + q, cy - r, cx - k, cy - r, 1],
        [edge, cy - reach, edge + k * Math.sin(angle), cy - reach + k * Math.cos(angle), null, null, 0],
        [edge, 0, null, null, null, null, 0],
      ],
      [
        [cx + inner, cy, cx + inner, cy - qi, cx + inner, cy + qi, 1],
        [cx, cy + inner, cx + qi, cy + inner, cx - qi, cy + inner, 1],
        [cx - inner, cy, cx - inner, cy + qi, cx - inner, cy - qi, 1],
        [cx, cy - inner, cx - qi, cy - inner, cx + qi, cy - inner, 1],
      ],
    ];
    var plan = Morph.plan(simple, letter);

    var group = svg('g', '', canvas);
    var build = svg('g', '', group);
    attrs(svg('rect', 'how-build', build), { x: left, y: 0, width: STEM, height: top });
    attrs(svg('circle', 'how-build', build), { cx: cx, cy: cy, r: r });
    attrs(svg('circle', 'how-build', build), { cx: cx, cy: cy, r: inner });
    var shape = svg('path', 'how-shape', group);
    var marks = svg('g', '', group);
    letter.forEach(function (contour) {
      contour.forEach(function (n) {
        [[n[2], n[3]], [n[4], n[5]]].forEach(function (h) {
          if (h[0] !== null) attrs(svg('line', 'how-handle', marks), { x1: n[0], y1: n[1], x2: h[0], y2: h[1] });
        });
      });
    });
    letter.forEach(function (contour) {
      contour.forEach(function (n) {
        if (n[6]) attrs(svg('circle', 'how-node', marks), { cx: n[0], cy: n[1], r: 7.5 });
        else attrs(svg('rect', 'how-node', marks), { x: n[0] - 6.5, y: n[1] - 6.5, width: 13, height: 13 });
      });
    });

    var shownStep = -1;
    function render(p) {
      var morph = smooth(0.12, 0.88, p);
      var out = smooth(1.15, 1.85, p);
      shape.setAttribute('d', morph <= 0 ? Morph.pathOf(simple) : morph >= 1 ? Morph.pathOf(letter) : Morph.render(plan, morph, 0.35));
      shape.style.fillOpacity = String(0.07 + out * 0.93);
      build.style.opacity = String(1 - smooth(0, 0.55, p));
      marks.style.opacity = String(smooth(0.88, 1, p) * (1 - smooth(1.1, 1.45, p)));
      var scale = 0.66 - out * 0.2;
      attrs(group, { transform: 'translate(0 ' + (230 - out * 150) + ') scale(' + scale + ' ' + -scale + ')' });
      file.style.setProperty('--o', smooth(1.4, 1.9, p).toFixed(3));
      var step = Math.round(p);
      if (step === shownStep) return;
      shownStep = step;
      steps.forEach(function (node, i) { node.classList.toggle('is-active', i === step); });
      dots.forEach(function (node, i) { node.classList.toggle('is-active', i === step); });
    }

    function progress() {
      // El paso cuyo centro pasa por la línea de lectura marca el avance, con decimales entre uno y otro.
      var line = window.innerHeight * (narrow.matches ? 0.74 : 0.5);
      var centers = steps.map(function (node) {
        var area = node.getBoundingClientRect();
        return area.top + area.height / 2;
      });
      if (line <= centers[0]) return 0;
      for (var i = 0; i < centers.length - 1; i++) {
        if (line <= centers[i + 1]) return i + (line - centers[i]) / (centers[i + 1] - centers[i]);
      }
      return centers.length - 1;
    }

    var near = false;
    var pending = false;
    function update() {
      pending = false;
      render(progress());
    }
    function request() {
      if (!near || pending) return;
      pending = true;
      requestAnimationFrame(update);
    }
    watch(section, function (visible) {
      near = visible;
      request();
    }, '20% 0px');
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    render(0);
  })();

  // ── Precios ─────────────────────────────────────────────────────────────────

  (function pricing() {
    var host = $('#plans');
    if (!host) return;
    var settings = CONFIG.pricing;
    var note = $('.billing-note');
    var mode = 'monthly';
    var CHECK = 'M5 12.5l4.5 4.5L19 7.5';

    function money(amount) {
      var digits = Number.isInteger(amount) ? 0 : 2;
      var parts = new Intl.NumberFormat(settings.locale, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).formatToParts(amount);
      var symbol = '';
      var number = '';
      parts.forEach(function (part) {
        if (part.type === 'currency') symbol = part.value;
        else if (part.type !== 'literal') number += part.value;
      });
      return { symbol: symbol, number: number };
    }
    function link(target, plan) {
      var signup = 'login.html?modo=registro&plan=' + encodeURIComponent(plan.id);
      if (target === 'app') return CONFIG.appUrl;
      if (target === 'contact') return CONFIG.contactUrl || signup;
      return signup;
    }

    var cards = settings.plans.map(function (plan, i) {
      var card = el('article', 'plan' + (plan.featured ? ' is-featured' : ''));
      card.setAttribute('data-reveal', '');
      card.style.setProperty('--d', String(i));

      var top = el('div', 'plan-top');
      top.appendChild(el('h3', 'plan-name', plan.name));
      if (plan.soon) top.appendChild(el('span', 'plan-soon', 'Próximamente'));
      card.appendChild(top);
      card.appendChild(el('p', 'plan-tagline', plan.tagline));

      var price = el('p', 'plan-price');
      var symbol = el('sup');
      var amount = el('span', 'plan-amount');
      var period = el('span', 'plan-period', plan.period);
      price.appendChild(symbol);
      price.appendChild(amount);
      price.appendChild(period);
      card.appendChild(price);
      var billed = el('p', 'plan-billed');
      card.appendChild(billed);

      var button = el('a', 'btn ' + (plan.featured ? 'btn-primary' : 'btn-outline'), plan.cta.label);
      button.href = link(plan.cta.href, plan);
      card.appendChild(button);

      if (plan.lead) card.appendChild(el('p', 'plan-lead', plan.lead));
      var list = el('ul', 'plan-features');
      plan.features.forEach(function (text) {
        var item = el('li');
        var icon = attrs(svg('svg'), { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
        attrs(svg('path', '', icon), { d: CHECK });
        item.appendChild(icon);
        item.appendChild(el('span', '', text));
        list.appendChild(item);
      });
      card.appendChild(list);
      host.appendChild(card);
      return { plan: plan, symbol: symbol, amount: amount, billed: billed };
    });

    function paint(animated) {
      cards.forEach(function (card) {
        var plan = card.plan;
        var yearly = mode === 'annual' && plan.annual > 0;
        var value = money(yearly ? plan.annual / 12 : plan.monthly);
        var text = yearly ? 'Facturado una vez al año: ' + money(plan.annual).symbol + ' ' + money(plan.annual).number : '';
        card.symbol.textContent = value.symbol;
        card.billed.textContent = text;
        if (!animated || reduced || card.amount.textContent === value.number) {
          card.amount.textContent = value.number;
          return;
        }
        card.amount.classList.add('is-changing');
        setTimeout(function () {
          card.amount.textContent = value.number;
          card.amount.classList.remove('is-changing');
        }, 220);
      });
      note.textContent = settings.annualNote || '';
      note.classList.toggle('is-on', mode === 'annual' && !!settings.annualNote);
    }

    paint(false);
    segmented($('.billing .seg'), 'aria-pressed', function (button) {
      mode = button.dataset.billing;
      paint(true);
    });

    // Las tarjetas se crean aquí, después de que la página haya repartido las apariciones.
    if (reduced || !('IntersectionObserver' in window)) {
      $$('.plan', host).forEach(function (card) { card.classList.add('is-in'); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
          setTimeout(function () { entry.target.style.setProperty('--d', '0'); }, 1400);
        });
      },
      { rootMargin: '0px 0px -7% 0px', threshold: 0.12 },
    );
    $$('.plan', host).forEach(function (card) { observer.observe(card); });
  })();

  // ── Preguntas ───────────────────────────────────────────────────────────────

  $$('.faq-item').forEach(function (item, _, all) {
    var button = $('button', item);
    button.addEventListener('click', function () {
      var open = !item.classList.contains('is-open');
      all.forEach(function (other) {
        other.classList.remove('is-open');
        $('button', other).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    });
  });

  // ── Cierre: una letra que no deja de cambiar y una palabra que se funde en otra ──

  (function closing() {
    var host = $('.closing');
    if (!host) return;
    var canvas = $('.closing-glyph svg', host);
    var group = attrs(svg('g', '', canvas), { transform: 'scale(1 -1)' });
    var path = svg('path', '', group);
    var shapes = ['g', 'a', '&', 'f'].map(function (letter) { return Morph.centered(GLYPHS.italic[letter]); });
    var loop = Morph.cycle(path, shapes, { duration: 2300, hold: 1300, wave: 0.7 });
    watch(host, function (visible) {
      if (visible && !reduced) loop.start();
      else loop.stop();
    });

    var swap = $('.swap', host);
    if (!swap) return;
    var words = swap.dataset.swap.split(',');
    var a = $('.swap-a', swap);
    var b = $('.swap-b', swap);
    var word = 0;
    $('.closing-title', host).setAttribute('aria-label', 'Tu próxima ' + words[0] + ' empieza aquí.');
    swap.setAttribute('aria-hidden', 'true');
    loopWhileVisible(host, 3000, function () {
      word = (word + 1) % words.length;
      b.textContent = words[word];
      swap.classList.add('is-morphing');
      var unit = parseFloat(getComputedStyle(swap).fontSize) / 96;
      var start = null;
      requestAnimationFrame(function frame(now) {
        if (start === null) start = now;
        var t = clamp((now - start) / 1100, 0, 1);
        var gone = Math.max(1 - t, 0.0001);
        var come = Math.max(t, 0.0001);
        a.style.filter = 'blur(' + Math.min(8 / gone - 8, 100) * unit + 'px)';
        a.style.opacity = String(Math.pow(gone, 0.4));
        b.style.filter = 'blur(' + Math.min(8 / come - 8, 100) * unit + 'px)';
        b.style.opacity = String(Math.pow(come, 0.4));
        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }
        a.textContent = words[word];
        a.style.filter = '';
        a.style.opacity = '';
        b.style.filter = '';
        b.style.opacity = '';
        swap.classList.remove('is-morphing');
      });
    });
  })();
})();
