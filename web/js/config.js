/*
 * Lo que cambia sin tocar el diseño: direcciones, precios y planes.
 * La página lee todo de aquí; basta editar este archivo y recargar.
 */
window.GLIFO_CONFIG = {
  /** Dónde está publicado el editor. */
  appUrl: 'https://underk0wer.github.io/glifo/',

  /** Dirección de contacto para el plan de equipos. Vacía: el botón lleva al registro. */
  contactUrl: '',

  pricing: {
    currency: 'USD',
    locale: 'es',
    /** Texto bajo el interruptor cuando se elige el pago anual. */
    annualNote: '2 meses gratis',
    plans: [
      {
        id: 'libre',
        name: 'Libre',
        tagline: 'El editor completo, sin cuenta y sin fecha de caducidad.',
        monthly: 0,
        annual: 0,
        period: 'para siempre',
        cta: { label: 'Abrir el editor', href: 'app' },
        features: [
          'Editor vectorial completo',
          'Métricas, kerning y familias',
          'Exportación OTF, TTF, WOFF y WOFF2',
          'Proyectos guardados en tu navegador',
          'Archivos .glifo para llevarlos contigo',
        ],
      },
      {
        id: 'premium',
        name: 'Premium',
        tagline: 'Tus proyectos contigo, en cualquier equipo.',
        monthly: 9,
        annual: 90,
        period: 'al mes',
        featured: true,
        soon: true,
        cta: { label: 'Crear cuenta', href: 'signup' },
        lead: 'Todo lo de Libre, y además:',
        features: [
          'Cuenta y biblioteca en la nube',
          'Sincronización entre dispositivos',
          'Copia de seguridad de tus proyectos',
          'Acceso anticipado a las novedades',
          'Soporte prioritario',
        ],
      },
      {
        id: 'estudio',
        name: 'Estudio',
        tagline: 'Para equipos que diseñan tipografía juntos.',
        monthly: 24,
        annual: 240,
        period: 'al mes',
        soon: true,
        cta: { label: 'Hablar con nosotros', href: 'contact' },
        lead: 'Todo lo de Premium, y además:',
        features: [
          'Varias personas, una sola biblioteca',
          'Proyectos compartidos del equipo',
          'Facturación para empresas',
          'Acompañamiento en la puesta en marcha',
        ],
      },
    ],
  },
};
