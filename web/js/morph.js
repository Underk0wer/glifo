/*
 * Transformación de un contorno en otro.
 *
 * Los contornos son listas de nodos [x, y, entradaX, entradaY, salidaX, salidaY, suave], como en el
 * editor. Para pasar de una forma a otra se reparten puntos a lo largo de cada contorno (siempre
 * uno en cada nodo, para no redondear las esquinas), se empareja cada contorno con el más parecido
 * de la otra forma y se mueve cada punto hacia su pareja.
 */
window.GlifoMorph = (function () {
  'use strict';

  var HIX = 2, HIY = 3, HOX = 4, HOY = 5;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /** Rectas [x0, y0, x1, y1] y curvas [x0, y0, c1x, c1y, c2x, c2y, x1, y1] de un contorno cerrado. */
  function segmentsOf(contour) {
    var segs = [];
    for (var i = 0; i < contour.length; i++) {
      var a = contour[i];
      var b = contour[(i + 1) % contour.length];
      if (a[HOX] === null && b[HIX] === null) {
        segs.push([a[0], a[1], b[0], b[1]]);
      } else {
        segs.push([
          a[0], a[1],
          a[HOX] === null ? a[0] : a[HOX], a[HOY] === null ? a[1] : a[HOY],
          b[HIX] === null ? b[0] : b[HIX], b[HIY] === null ? b[1] : b[HIY],
          b[0], b[1],
        ]);
      }
    }
    return segs;
  }

  /** El trazado exacto, con sus curvas, en unidades de la fuente. */
  function pathOf(contours) {
    var d = '';
    for (var c = 0; c < contours.length; c++) {
      var segs = segmentsOf(contours[c]);
      if (!segs.length) continue;
      d += 'M' + segs[0][0] + ' ' + segs[0][1];
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        d += s.length === 4 ? 'L' + s[2] + ' ' + s[3] : 'C' + s[2] + ' ' + s[3] + ' ' + s[4] + ' ' + s[5] + ' ' + s[6] + ' ' + s[7];
      }
      d += 'Z';
    }
    return d;
  }

  function pointAt(seg, t, out, k) {
    if (seg.length === 4) {
      out[k] = seg[0] + (seg[2] - seg[0]) * t;
      out[k + 1] = seg[1] + (seg[3] - seg[1]) * t;
      return;
    }
    var u = 1 - t;
    var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out[k] = a * seg[0] + b * seg[2] + c * seg[4] + d * seg[6];
    out[k + 1] = a * seg[1] + b * seg[3] + c * seg[5] + d * seg[7];
  }

  var scratch = [0, 0];
  function lengthOf(seg) {
    if (seg.length === 4) return Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
    var total = 0, px = seg[0], py = seg[1];
    for (var i = 1; i <= 12; i++) {
      pointAt(seg, i / 12, scratch, 0);
      total += Math.hypot(scratch[0] - px, scratch[1] - py);
      px = scratch[0];
      py = scratch[1];
    }
    return total;
  }

  function perimeter(contour) {
    return segmentsOf(contour).reduce(function (sum, seg) { return sum + lengthOf(seg); }, 0);
  }

  /** `count` puntos sobre el contorno, repartidos según la longitud de cada tramo. */
  function resample(contour, count) {
    var segs = segmentsOf(contour);
    var lens = segs.map(lengthOf);
    var total = lens.reduce(function (a, b) { return a + b; }, 0) || 1;
    count = Math.max(count, segs.length);
    var share = [], rest = [], used = 0, i;
    for (i = 0; i < segs.length; i++) {
      var ideal = (count * lens[i]) / total;
      share[i] = Math.max(1, Math.floor(ideal));
      rest[i] = ideal - share[i];
      used += share[i];
    }
    while (used !== count) {
      var pick = -1;
      for (i = 0; i < segs.length; i++) {
        if (used < count ? pick < 0 || rest[i] > rest[pick] : share[i] > 1 && (pick < 0 || rest[i] < rest[pick])) pick = i;
      }
      var step = used < count ? 1 : -1;
      share[pick] += step;
      rest[pick] -= step;
      used += step;
    }
    var out = new Float32Array(count * 2), p = 0;
    for (i = 0; i < segs.length; i++) {
      for (var j = 0; j < share[i]; j++) {
        pointAt(segs[i], j / share[i], out, p);
        p += 2;
      }
    }
    return out;
  }

  function areaOf(points) {
    var sum = 0, n = points.length;
    for (var i = 0; i < n; i += 2) {
      var j = (i + 2) % n;
      sum += points[i] * points[j + 1] - points[j] * points[i + 1];
    }
    return sum / 2;
  }

  function centroidOf(points) {
    var x = 0, y = 0, n = points.length / 2;
    for (var i = 0; i < points.length; i += 2) {
      x += points[i];
      y += points[i + 1];
    }
    return [x / n, y / n];
  }

  function reversed(points) {
    var n = points.length, out = new Float32Array(n);
    for (var i = 0; i < n; i += 2) {
      out[i] = points[n - 2 - i];
      out[i + 1] = points[n - 1 - i];
    }
    return out;
  }

  /** El mismo anillo empezando en el punto que menos obliga a moverse a los demás. */
  function aligned(from, to) {
    var n = from.length / 2, best = 0, bestCost = Infinity;
    for (var k = 0; k < n; k++) {
      var cost = 0;
      for (var i = 0; i < n && cost < bestCost; i++) {
        var j = ((i + k) % n) * 2;
        var dx = from[i * 2] - to[j], dy = from[i * 2 + 1] - to[j + 1];
        cost += dx * dx + dy * dy;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = k;
      }
    }
    if (!best) return to;
    var out = new Float32Array(n * 2);
    for (var p = 0; p < n; p++) {
      var q = ((p + best) % n) * 2;
      out[p * 2] = to[q];
      out[p * 2 + 1] = to[q + 1];
    }
    return out;
  }

  /** Un anillo con todos sus puntos en el mismo sitio: de ahí nace un contorno, o ahí se recoge. */
  function collapsed(count, at) {
    var out = new Float32Array(count);
    for (var i = 0; i < count; i += 2) {
      out[i] = at[0];
      out[i + 1] = at[1];
    }
    return out;
  }

  function nearestOn(ring, point) {
    var best = 0, bestDistance = Infinity;
    for (var i = 0; i < ring.length; i += 2) {
      var dx = ring[i] - point[0], dy = ring[i + 1] - point[1];
      if (dx * dx + dy * dy < bestDistance) {
        bestDistance = dx * dx + dy * dy;
        best = i;
      }
    }
    return [ring[best], ring[best + 1]];
  }

  /** Rellenos y huecos de una forma, de mayor a menor. */
  function describe(contours) {
    var items = contours.map(function (contour) {
      return { contour: contour, area: areaOf(resample(contour, 72)), length: perimeter(contour) };
    });
    var largest = items.reduce(function (a, b) { return Math.abs(b.area) > Math.abs(a.area) ? b : a; }, items[0]);
    var sign = largest && largest.area < 0 ? -1 : 1;
    var bySize = function (a, b) { return Math.abs(b.area) - Math.abs(a.area); };
    return {
      sign: sign,
      solids: items.filter(function (it) { return it.area * sign >= 0; }).sort(bySize),
      holes: items.filter(function (it) { return it.area * sign < 0; }).sort(bySize),
    };
  }

  /**
   * Prepara el paso de una forma a otra. Un relleno se convierte en un relleno y un hueco en un
   * hueco. La pieza que no tiene pareja (el punto de la «i», la oreja de la «g») sale del cuerpo
   * de la otra letra o se funde con él; el hueco sin pareja se abre o se cierra en su centro.
   */
  function plan(from, to, options) {
    var density = (options && options.density) || 8;
    var A = describe(from), B = describe(to);
    var flip = A.sign !== B.sign;
    var pairs = [], minY = Infinity, maxY = -Infinity;
    var bodyA = null, bodyB = null;
    [['solids', A.solids, B.solids], ['holes', A.holes, B.holes]].forEach(function (group) {
      var count = Math.max(group[1].length, group[2].length);
      for (var i = 0; i < count; i++) {
        var a = group[1][i], b = group[2][i];
        var n = clamp(Math.round(Math.max(a ? a.length : 0, b ? b.length : 0) / density), 40, 360);
        var pa = a ? resample(a.contour, n) : null;
        var pb = b ? resample(b.contour, n) : null;
        if (pb && flip) pb = reversed(pb);
        var solid = group[0] === 'solids';
        if (pa && pb) pb = aligned(pa, pb);
        else if (pa) pb = collapsed(pa.length, solid && bodyB ? nearestOn(bodyB, centroidOf(pa)) : centroidOf(pa));
        else pa = collapsed(pb.length, solid && bodyA ? nearestOn(bodyA, centroidOf(pb)) : centroidOf(pb));
        if (solid && i === 0) {
          bodyA = pa;
          bodyB = pb;
        }
        pairs.push({ a: pa, b: pb });
        for (var k = 1; k < pa.length; k += 2) {
          minY = Math.min(minY, pa[k], pb[k]);
          maxY = Math.max(maxY, pa[k], pb[k]);
        }
      }
    });
    return { pairs: pairs, minY: minY, maxY: maxY };
  }

  /**
   * El trazado en el instante `t` (de 0 a 1). Con `wave` mayor que cero la transformación recorre
   * la forma de abajo arriba en lugar de ocurrir toda a la vez.
   */
  function render(steps, t, wave) {
    var span = steps.maxY - steps.minY || 1;
    var d = '';
    wave = wave || 0;
    for (var p = 0; p < steps.pairs.length; p++) {
      var a = steps.pairs[p].a, b = steps.pairs[p].b;
      for (var i = 0; i < a.length; i += 2) {
        var phase = wave ? ((a[i + 1] + b[i + 1]) / 2 - steps.minY) / span : 0;
        var e = easeInOut(clamp(t * (1 + wave) - phase * wave, 0, 1));
        d += (i ? 'L' : 'M') + (a[i] + (b[i] - a[i]) * e).toFixed(1) + ' ' + (a[i + 1] + (b[i + 1] - a[i + 1]) * e).toFixed(1);
      }
      d += 'Z';
    }
    return d;
  }

  /** Copia de los contornos de un glifo con el ancho de avance centrado en x = 0. */
  function centered(glyph) {
    var half = glyph.adv / 2;
    return glyph.contours.map(function (contour) {
      return contour.map(function (n) {
        return [n[0] - half, n[1], n[HIX] === null ? null : n[HIX] - half, n[HIY], n[HOX] === null ? null : n[HOX] - half, n[HOY], n[6]];
      });
    });
  }

  function clone(contours) {
    return contours.map(function (contour) {
      return contour.map(function (n) { return n.slice(); });
    });
  }

  /**
   * Hace que `path` pase sin parar de una forma a la siguiente. Devuelve cómo ponerlo en marcha
   * y cómo detenerlo, para que solo trabaje mientras se ve.
   */
  function cycle(path, shapes, options) {
    var duration = (options && options.duration) || 2300;
    var hold = (options && options.hold) || 1300;
    var wave = (options && options.wave) || 0.6;
    var at = 0, running = false, busy = false, timer = null;
    path.setAttribute('d', pathOf(shapes[0]));
    function next() {
      if (!running || busy) return;
      var target = (at + 1) % shapes.length;
      var steps = plan(shapes[at], shapes[target]);
      var start = null;
      busy = true;
      requestAnimationFrame(function frame(now) {
        if (start === null) start = now;
        var t = clamp((now - start) / duration, 0, 1);
        path.setAttribute('d', t < 1 ? render(steps, t, wave) : pathOf(shapes[target]));
        if (t < 1) {
          requestAnimationFrame(frame);
          return;
        }
        at = target;
        busy = false;
        timer = setTimeout(next, hold);
      });
    }
    return {
      start: function () {
        if (running) return;
        running = true;
        timer = setTimeout(next, hold);
      },
      stop: function () {
        running = false;
        clearTimeout(timer);
      },
    };
  }

  /** Longitud de cada tramo de un contorno, en su orden. */
  function lengths(contour) {
    return segmentsOf(contour).map(lengthOf);
  }

  return {
    pathOf: pathOf,
    perimeter: perimeter,
    lengths: lengths,
    cycle: cycle,
    resample: resample,
    plan: plan,
    render: render,
    centered: centered,
    clone: clone,
    easeInOut: easeInOut,
    clamp: clamp,
  };
})();
