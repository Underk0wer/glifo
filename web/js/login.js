/* Pantalla de acceso: iniciar sesión o crear cuenta. */
(function () {
  'use strict';

  var CONFIG = window.GLIFO_CONFIG;
  var GLYPHS = window.GLIFO_GLYPHS;
  var Morph = window.GlifoMorph;
  var UI = window.GlifoUI;
  var form = document.querySelector('.auth-form');
  if (!form) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var title = document.querySelector('.auth-title');
  var sub = document.querySelector('.auth-sub');
  var planChip = document.querySelector('.auth-plan');
  var notice = document.querySelector('.auth-notice');
  var alt = document.querySelector('.auth-alt');
  var tabs = document.querySelector('.auth-tabs');
  var submit = form.querySelector('.auth-submit');
  var forgot = form.querySelector('[data-forgot]');
  var fields = {
    name: form.querySelector('#nombre'),
    email: form.querySelector('#correo'),
    password: form.querySelector('#clave'),
  };

  var COPY = {
    login: {
      title: ['Hola ', 'de nuevo.'],
      sub: 'Entra para tener tus proyectos en cualquier equipo.',
      submit: 'Iniciar sesión',
      page: 'Iniciar sesión — Glifo',
    },
    signup: {
      title: ['Crea ', 'tu cuenta.'],
      sub: 'Guarda tus tipografías en la nube y ábrelas desde cualquier equipo.',
      submit: 'Crear cuenta',
      page: 'Crear cuenta — Glifo',
    },
  };
  var NOTICES = {
    unavailable: {
      title: 'Las cuentas llegan muy pronto',
      text: 'Todavía no están activas, así que no hemos enviado ni guardado tus datos. Mientras tanto, el editor funciona completo sin cuenta y guarda tus proyectos en este navegador.',
    },
    forgot: {
      title: 'Aún no hay contraseñas que recuperar',
      text: 'La recuperación se activará junto con las cuentas. Mientras tanto, el editor funciona completo sin cuenta.',
    },
    failed: {
      title: 'No hemos podido entrar',
      text: 'Revisa el correo y la contraseña, y vuelve a intentarlo.',
    },
  };

  var params = new URLSearchParams(window.location.search);
  var mode = params.get('modo') === 'registro' ? 'signup' : 'login';

  /**
   * Aquí va la llamada al servicio de cuentas, que devolverá { ok: true } o
   * { ok: false, reason: 'failed' }. Las cuentas todavía no están activas, así que hoy
   * no se envía nada: lo escrito en el formulario no sale de esta página.
   */
  function authenticate() {
    return Promise.resolve({ ok: false, reason: 'unavailable' });
  }

  // ── Plan elegido en la página de precios ─────────────────────────────────────

  var chosen = CONFIG.pricing.plans.filter(function (plan) { return plan.id === params.get('plan'); })[0];
  if (chosen) {
    planChip.textContent = 'Plan ' + chosen.name;
    planChip.hidden = false;
  }

  // ── Iniciar sesión o crear cuenta ────────────────────────────────────────────

  function fieldOf(input) {
    return input.closest('.field');
  }
  function setError(input, message) {
    var field = fieldOf(input);
    field.classList.toggle('is-invalid', !!message);
    field.querySelector('.field-error').textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  function clearErrors() {
    Object.keys(fields).forEach(function (key) { setError(fields[key], ''); });
  }

  function paint(animated) {
    var copy = COPY[mode];
    var signup = mode === 'signup';
    function write() {
      title.textContent = copy.title[0];
      var accent = document.createElement('em');
      accent.textContent = copy.title[1];
      title.appendChild(accent);
      sub.textContent = copy.sub;
    }
    if (animated && !reduced) {
      // El titular se desenfoca, cambia y vuelve.
      title.classList.add('is-swapping');
      sub.classList.add('is-swapping');
      setTimeout(function () {
        write();
        title.classList.remove('is-swapping');
        sub.classList.remove('is-swapping');
      }, 220);
    } else {
      write();
    }
    document.title = copy.page;
    submit.querySelector('span').textContent = copy.submit;
    fieldOf(fields.name).classList.toggle('is-collapsed', !signup);
    fields.name.tabIndex = signup ? 0 : -1;
    fields.password.autocomplete = signup ? 'new-password' : 'current-password';
    forgot.hidden = signup;
    clearErrors();
  }

  var control = UI.segmented(tabs, 'aria-pressed', function (button, byUser) {
    mode = button.dataset.mode;
    paint(byUser);
  });
  control.select(control.buttons.filter(function (b) { return b.dataset.mode === mode; })[0], false);

  Object.keys(fields).forEach(function (key) {
    fields[key].addEventListener('input', function () { setError(fields[key], ''); });
  });

  // ── Ver la contraseña ────────────────────────────────────────────────────────

  var eye = form.querySelector('.field-eye');
  eye.addEventListener('click', function () {
    var show = fields.password.type === 'password';
    fields.password.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Ocultar la contraseña' : 'Mostrar la contraseña');
  });

  // ── Enviar ───────────────────────────────────────────────────────────────────

  function validate() {
    var problems = [];
    var email = fields.email.value.trim();
    if (mode === 'signup' && !fields.name.value.trim()) problems.push([fields.name, 'Escribe tu nombre.']);
    if (!email) problems.push([fields.email, 'Escribe tu correo electrónico.']);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push([fields.email, 'Ese correo no parece completo. Debe tener la forma nombre@dominio.com.']);
    if (!fields.password.value) problems.push([fields.password, 'Escribe tu contraseña.']);
    else if (mode === 'signup' && fields.password.value.length < 8) problems.push([fields.password, 'Usa al menos 8 caracteres.']);
    clearErrors();
    problems.forEach(function (problem) { setError(problem[0], problem[1]); });
    if (problems.length) problems[0][0].focus();
    return !problems.length;
  }

  function showNotice(kind) {
    var content = NOTICES[kind] || NOTICES.failed;
    notice.querySelector('h2').textContent = content.title;
    notice.querySelector('p').textContent = content.text;
    form.hidden = true;
    tabs.hidden = true;
    alt.hidden = true;
    notice.hidden = false;
    notice.querySelector('.btn').focus({ preventScroll: true });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submit.classList.contains('is-busy') || !validate()) return;
    submit.classList.add('is-busy');
    submit.setAttribute('aria-busy', 'true');
    var wait = new Promise(function (resolve) { setTimeout(resolve, reduced ? 0 : 900); });
    Promise.all([authenticate(), wait]).then(function (results) {
      var result = results[0];
      submit.classList.remove('is-busy');
      submit.removeAttribute('aria-busy');
      // La contraseña no se conserva en la página una vez usada.
      fields.password.value = '';
      if (result.ok) {
        window.location.href = CONFIG.appUrl;
        return;
      }
      showNotice(result.reason);
    });
  });

  forgot.addEventListener('click', function () { showNotice('forgot'); });
  notice.querySelector('[data-back]').addEventListener('click', function () {
    notice.hidden = true;
    form.hidden = false;
    tabs.hidden = false;
    alt.hidden = false;
    control.place();
    fields.email.focus({ preventScroll: true });
  });

  // ── La letra del panel ───────────────────────────────────────────────────────

  var canvas = document.querySelector('.auth-art svg');
  if (!canvas) return;
  function node(name, cls, parent) {
    var el = document.createElementNS(SVG_NS, name);
    if (cls) el.setAttribute('class', cls);
    parent.appendChild(el);
    return el;
  }
  var M = GLYPHS.italicMetrics;
  [M.ascender, M.xHeight, 0, M.descender].forEach(function (value) {
    var line = node('line', 'art-line', canvas);
    line.setAttribute('x1', -4000);
    line.setAttribute('x2', 4000);
    line.setAttribute('y1', -value);
    line.setAttribute('y2', -value);
  });
  var group = node('g', '', canvas);
  group.setAttribute('transform', 'scale(1 -1)');
  var path = node('path', 'art-shape', group);
  var shapes = ['g', 'a', '&', 'f'].map(function (letter) { return Morph.centered(GLYPHS.italic[letter]); });
  var loop = Morph.cycle(path, shapes, { duration: 1800, hold: 1700, wave: 0.6 });
  if (!reduced) UI.watch(canvas, function (visible) { if (visible) loop.start(); else loop.stop(); });
})();
