/* Se carga en la cabecera, antes de pintar: fija el tema y adelanta la descarga de las tipografías. */
(function () {
  // Las tipografías del primer pantallazo se piden cuanto antes. Al abrir la página como archivo
  // (file://) el navegador no admite esa petición adelantada, y las carga la hoja de estilos.
  if (location.protocol !== 'file:') {
    ['fonts/fraunces.woff2', 'fonts/inter.woff2'].forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'font';
      link.type = 'font/woff2';
      link.crossOrigin = 'anonymous';
      link.href = href;
      document.head.appendChild(link);
    });
  }

  var KEY = 'glifo.web.theme';
  var stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (err) {
    // Sin almacenamiento se sigue la preferencia del sistema.
  }
  var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var root = document.documentElement;
  root.dataset.theme = stored === 'dark' || stored === 'light' ? stored : system;
  root.classList.add('js');

  window.GlifoTheme = {
    current: function () {
      return root.dataset.theme;
    },
    set: function (theme) {
      root.dataset.theme = theme;
      try {
        localStorage.setItem(KEY, theme);
      } catch (err) {
        // El tema vale igual para esta visita.
      }
    },
  };
})();
