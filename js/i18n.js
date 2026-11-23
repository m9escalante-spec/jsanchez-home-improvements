/* ==========================================================================
   Language switcher (English / Español)
   English text lives in index.html. Spanish text lives here, keyed by the
   element's data-i18n attribute. Strings used by scripts live in UI.
   ========================================================================== */
(function () {
  "use strict";

  var ES = {
    "skip": "Saltar al contenido",
    "nav.services": "Servicios", "nav.work": "Nuestro trabajo", "nav.process": "Cómo funciona",
    "nav.areas": "Áreas", "nav.faq": "Preguntas", "nav.menu": "Menú",
    "cta.book": "Reservar un estimado", "cta.call": "Llamar", "cta.text": "Mensaje", "cta.bookshort": "Reservar",

    "hero.pill": "Calidad · Confiabilidad · Precios accesibles",
    "hero.title1": "Su hogar,", "hero.title2": "nuestro compromiso.",
    "hero.lead": "Remodelación de baños y cocinas, pisos, techos, pintura, plomería y electricidad: un equipo confiable para cada proyecto en todo el condado de Broward.",
    "hero.p1": "Reserve en línea 24/7", "hero.p2": "Confirmación inmediata",
    "hero.next": "Próxima cita disponible", "hero.bookit": "Reservar", "hero.seven": "7 servicios · 1 llamada",

    "svc.bathroom": "Remodelación de baños", "svc.kitchen": "Remodelación de cocinas", "svc.flooring": "Pisos",
    "svc.ceiling": "Techos y cielo raso", "svc.painting": "Pintura interior", "svc.plumbing": "Plomería", "svc.electrical": "Electricidad",
    "svc.eyebrow": "Lo que hacemos",
    "svc.title": "Cada espacio. Cada reparación. Un solo equipo.",
    "svc.lead": "Desde un grifo que gotea hasta una remodelación completa: lo planificamos, lo construimos y dejamos todo limpio. Usted solo hace una llamada.",
    "svc.bathroom.d": "Renovaciones completas de baños: duchas, bañeras, tocadores, azulejos y grifería, pensados para su estilo de vida.",
    "svc.bathroom.l1": "Duchas walk-in y conversión de bañeras", "svc.bathroom.l2": "Azulejos, tocadores y grifería", "svc.bathroom.l3": "Mamparas de vidrio e iluminación",
    "svc.kitchen.d": "Gabinetes, encimeras, salpicaderos y distribuciones que vuelven a hacer de su cocina el corazón del hogar.",
    "svc.kitchen.l1": "Instalación y renovación de gabinetes", "svc.kitchen.l2": "Encimeras y salpicaderos", "svc.kitchen.l3": "Islas, iluminación y herrajes",
    "svc.flooring.d": "Cerámica, vinil de lujo, laminado y madera, instalados nivelados, firmes y duraderos.",
    "svc.flooring.l1": "Porcelanato y cerámica", "svc.flooring.l2": "Vinil de lujo y laminado", "svc.flooring.l3": "Nivelación, preparación y zócalos",
    "svc.ceiling.d": "Techos de drywall, remoción de popcorn, reparaciones y acabados lisos para un look limpio y moderno.",
    "svc.ceiling.l1": "Remoción de techo popcorn", "svc.ceiling.l2": "Reparación y textura de drywall", "svc.ceiling.l3": "Parches por daños de agua",
    "svc.painting.d": "Líneas limpias, preparación cuidadosa y limpieza impecable: habitaciones, molduras, puertas y gabinetes.",
    "svc.painting.l1": "Paredes, techos y molduras", "svc.painting.l2": "Pintura de gabinetes y puertas", "svc.painting.l3": "Resanado y preparación antes de pintar",
    "svc.plumbing.d": "Grifos, inodoros, lavamanos, fugas y mejoras de accesorios, bien hechos a la primera.",
    "svc.plumbing.l1": "Instalación de grifos, lavamanos e inodoros", "svc.plumbing.l2": "Detección y reparación de fugas", "svc.plumbing.l3": "Trituradores y mejoras de accesorios",
    "svc.electrical.d": "Iluminación, ventiladores de techo, tomacorrientes e interruptores instalados de forma segura y ordenada.",
    "svc.electrical.l1": "Lámparas y ventiladores de techo", "svc.electrical.l2": "Tomacorrientes, interruptores y USB", "svc.electrical.l3": "Luces empotradas y bajo gabinete",
    "svc.bookthis": "Reservar este servicio",
    "svc.other.t": "¿Algo más?",
    "svc.other.d": "Puertas, molduras, drywall, pequeñas reparaciones y listas de pendientes. Si está en su casa, pregúntenos.",
    "svc.other.cta": "Cuéntenos",

    "work.eyebrow": "Trabajos terminados", "work.title": "Proyectos reales. Resultados reales.",
    "work.lead": "Un vistazo a baños, cocinas, pisos y más. Toque cualquier proyecto para verlo de cerca y deslice para comparar el antes y el después.",
    "work.empty": "Pronto publicaremos fotos de nuestros proyectos. ¿Quiere ver el suyo aquí? Reserve su proyecto hoy.",

    "proc.eyebrow": "Cómo funciona", "proc.title": "Del primer mensaje al trabajo terminado.",
    "proc.s1.t": "Reserve en línea", "proc.s1.d": "Elija su servicio y un horario que le convenga; toma alrededor de un minuto. ¿Prefiere hablar? Llámenos o escríbanos.",
    "proc.s2.t": "Respuesta inmediata", "proc.s2.d": "Recibe al instante una confirmación automática con los detalles de su cita, y nos comunicamos para confirmar la visita.",
    "proc.s3.t": "Visita de estimado", "proc.s3.d": "Revisamos el proyecto con usted, tomamos medidas y le entregamos un estimado claro por escrito.",
    "proc.s4.t": "Bien hecho", "proc.s4.d": "Hacemos el trabajo, lo mantenemos informado y dejamos todo limpio. Su hogar, nuestro compromiso.",

    "book.eyebrow": "Reservas en línea", "book.title": "Reserve su estimado en un minuto.",
    "book.lead": "Elija lo que necesita y cuándo. Recibirá una confirmación automática por correo en cuanto reserve.",
    "book.p1": "Horarios disponibles en tiempo real", "book.p2": "Confirmación inmediata por correo",
    "book.p3": "Agréguelo a su calendario con un toque", "book.p4": "Adjunte fotos de su proyecto",
    "book.alt": "¿Prefiere hablar con una persona?",
    "book.s1": "Servicio", "book.s2": "Fecha y hora", "book.s3": "Proyecto", "book.s4": "Contacto",
    "book.q1": "¿En qué le podemos ayudar?", "book.q1h": "Elija uno o más.",
    "book.q2": "Elija el día y la hora para su visita de estimado",
    "book.pickday": "Seleccione un día para ver los horarios disponibles.",
    "book.tz": "Horario del Este. Cada visita dura entre 60 y 90 minutos.",
    "book.q3": "Cuéntenos sobre el proyecto", "book.q4": "¿Cómo lo contactamos?",
    "book.consent": "Al reservar, acepta que J Sanchez Home Improvements lo contacte sobre esta solicitud. Nunca compartimos su información.",
    "book.back": "Atrás", "book.next": "Continuar", "book.submit": "Confirmar reserva",

    "err.services": "Elija al menos un servicio.", "err.slot": "Elija un día y una hora.",
    "err.details": "Agregue una breve descripción (al menos 10 caracteres).", "err.zip": "Ingrese un código postal de 5 dígitos.",
    "err.name": "Ingrese su nombre.", "err.phone": "Ingrese un número de teléfono válido de 10 dígitos.", "err.email": "Ingrese un correo electrónico válido.",

    "f.details": "¿Qué le gustaría hacer?",
    "f.details.ph": "Ej.: Cambiar la bañera por una ducha walk-in, nuevo tocador y piso de cerámica (aprox. 5x8 pies).",
    "f.zip": "Código postal", "f.property": "Tipo de propiedad",
    "f.prop.house": "Casa", "f.prop.condo": "Condominio / Apartamento", "f.prop.town": "Townhouse", "f.prop.comm": "Comercial",
    "f.address": "Dirección", "f.optional": "(opcional)", "f.timeline": "¿Cuándo le gustaría empezar?",
    "f.tl.asap": "Lo antes posible", "f.tl.soon": "En 1 a 3 meses", "f.tl.plan": "Solo estoy planificando",
    "f.photos": "Fotos del área", "f.photos.cta": "Toque para agregar hasta 4 fotos",
    "f.photos.alt": "¿Tiene fotos? Envíelas por mensaje al 954-295-7763 después de reservar.",
    "f.name": "Nombre completo", "f.phone": "Teléfono celular", "f.email": "Correo electrónico (para su confirmación)",
    "f.contact": "La mejor forma de contactarlo", "f.c.text": "Mensaje de texto", "f.c.call": "Llamada",

    "ok.title": "¡Su cita está reservada!", "ok.ref": "Confirmación n.º",
    "ok.gcal": "Agregar a Google Calendar", "ok.ics": "Apple / Outlook (.ics)", "ok.sms": "Envíenos fotos",
    "ok.n1": "Revise su correo: su confirmación va en camino.",
    "ok.n2": "Revisaremos su solicitud y confirmaremos la visita (o le sugeriremos otro horario).",
    "ok.n3": "Llegamos a tiempo, revisamos el proyecto con usted y le damos un estimado por escrito.",
    "ok.again": "Reservar otro servicio",

    "why.eyebrow": "Por qué nos llaman", "why.title": "Tres promesas que cumplimos.",
    "why.q.t": "Calidad", "why.q.d": "Materiales de calidad, preparación cuidadosa y acabados de los que estamos orgullosos.",
    "why.r.t": "Confiabilidad", "why.r.d": "Llegamos cuando decimos, nos comunicamos con claridad y terminamos lo que empezamos.",
    "why.a.t": "Precios accesibles", "why.a.d": "Estimados honestos y por escrito, sin sorpresas: grandes resultados que respetan su presupuesto.",

    "areas.eyebrow": "Área de servicio", "areas.title": "Orgullosos de servir al condado de Broward.",
    "areas.lead": "¿No ve su ciudad? Escríbanos: muchas veces viajamos por el proyecto adecuado.",

    "faq.eyebrow": "Preguntas", "faq.title": "Lo que debe saber.",
    "faq.q1": "¿Cómo obtengo un estimado?",
    "faq.a1": "Reserve en línea en un minuto, o llame o envíe un mensaje al 954-295-7763. Confirmaremos una hora para ver su proyecto en persona y le daremos un estimado por escrito.",
    "faq.q2": "¿Qué pasa después de reservar en línea?",
    "faq.a2": "Recibirá de inmediato un correo de confirmación automático con los detalles de su reserva. Revisamos cada solicitud y confirmamos su visita —o le sugerimos un mejor horario— por el medio de contacto que prefiera.",
    "faq.q3": "¿También hacen trabajos pequeños?",
    "faq.a3": "Sí. Hacemos de todo, desde una sola reparación hasta la remodelación completa de una cocina o un baño.",
    "faq.q4": "¿Puedo enviar fotos de mi proyecto?",
    "faq.a4": "¡Claro! Las fotos nos ayudan a prepararnos. Adjúntelas al reservar o envíelas por mensaje al 954-295-7763.",
    "faq.q5": "¿En qué áreas trabajan?",
    "faq.a5": "Trabajamos en todo el condado de Broward, incluyendo Fort Lauderdale, Hollywood, Pembroke Pines, Miramar, Coral Springs, Davie, Plantation, Weston y ciudades cercanas.",
    "faq.q6": "¿Hablan español?",
    "faq.a6": "¡Sí! Se habla español. Use el botón de idioma en la parte superior para cambiar entre español e inglés.",

    "band.title": "¿Listo para volver a amar su hogar?",
    "band.lead": "Cuéntenos lo que tiene en mente; nosotros nos encargamos del resto.",

    "footer.tag": "Su hogar, nuestro compromiso", "footer.contact": "Contacto", "footer.services": "Servicios",
    "footer.explore": "Explorar", "footer.rights": "Todos los derechos reservados.",

    "chat.open": "Chatee con nosotros", "chat.status": "Asistente automático · respuestas al instante", "chat.ph": "Escriba su pregunta…"
  };

  // Strings used by scripts (booking, gallery, chat). {name} placeholders get filled in.
  var UI = {
    en: {
      "lang.label": "Español", "lang.aria": "Cambiar a español",
      "all": "All", "soon": "Photos coming soon", "compare": "Before & after", "before": "Before", "after": "After",
      "photos.count": "{n} photos", "view": "View project",
      "slots.pick": "Select a day to see open times.",
      "slots.for": "Open times · {date}", "slots.none": "No open times this day — please try another.",
      "slots.loading": "Checking availability…", "next.none": "Call to schedule",
      "sum.title": "Review your booking", "sum.services": "Services", "sum.when": "When", "sum.where": "Where", "sum.edit": "Edit",
      "status.sending": "Sending your booking…",
      "status.error": "We couldn't send your booking right now. Please try again — or call or text 954-295-7763 and we'll book you by phone.",
      "status.taken": "Sorry — that time was just taken. Please pick another time.",
      "ok.msg": "A confirmation is on its way to {email}. We'll reach out by {method} to confirm your visit.",
      "photos.max": "You can add up to {n} photos.", "photos.remove": "Remove photo",
      "sms.body": "Hi J Sanchez! I just booked online ({ref}). Here are photos of my project:",
      "sms.hello": "Hi J Sanchez! I'm interested in an estimate.",
      "event.title": "Estimate visit — J Sanchez Home Improvements",
      "event.desc": "Confirmation {ref}. Services: {services}. Questions? Call/text 954-295-7763.",
      "cal.prev": "Previous month", "cal.next": "Next month"
    },
    es: {
      "lang.label": "English", "lang.aria": "Switch to English",
      "all": "Todos", "soon": "Fotos muy pronto", "compare": "Antes y después", "before": "Antes", "after": "Después",
      "photos.count": "{n} fotos", "view": "Ver proyecto",
      "slots.pick": "Seleccione un día para ver los horarios disponibles.",
      "slots.for": "Horarios disponibles · {date}", "slots.none": "No hay horarios este día; pruebe con otro.",
      "slots.loading": "Consultando disponibilidad…", "next.none": "Llame para agendar",
      "sum.title": "Revise su reserva", "sum.services": "Servicios", "sum.when": "Cuándo", "sum.where": "Dónde", "sum.edit": "Editar",
      "status.sending": "Enviando su reserva…",
      "status.error": "No pudimos enviar su reserva en este momento. Inténtelo de nuevo, o llame o escriba al 954-295-7763 y lo agendamos por teléfono.",
      "status.taken": "Lo sentimos: ese horario se acaba de ocupar. Elija otro horario.",
      "ok.msg": "Le enviamos una confirmación a {email}. Lo contactaremos por {method} para confirmar su visita.",
      "photos.max": "Puede agregar hasta {n} fotos.", "photos.remove": "Quitar foto",
      "sms.body": "¡Hola J Sanchez! Acabo de reservar en línea ({ref}). Aquí están las fotos de mi proyecto:",
      "sms.hello": "¡Hola J Sanchez! Me interesa un estimado.",
      "event.title": "Visita de estimado — J Sanchez Home Improvements",
      "event.desc": "Confirmación {ref}. Servicios: {services}. ¿Preguntas? Llame o escriba al 954-295-7763.",
      "cal.prev": "Mes anterior", "cal.next": "Mes siguiente"
    }
  };

  var KEY = "jsh-lang";
  function load() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }

  var params = new URLSearchParams(location.search);
  var lang = params.get("lang") || load() ||
    ((navigator.language || "en").toLowerCase().indexOf("es") === 0 ? "es" : "en");
  if (lang !== "es") lang = "en";

  var originals = new Map();      // key -> English HTML from the page
  var attrOriginals = new WeakMap();

  function capture() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!originals.has(k)) originals.set(k, el.innerHTML);
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var map = {};
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":"); map[p[0]] = el.getAttribute(p[0]) || "";
      });
      attrOriginals.set(el, map);
    });
  }

  function apply(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!originals.has(k)) originals.set(k, el.innerHTML);
      var html = lang === "es" && ES[k] != null ? ES[k] : originals.get(k);
      if (el.innerHTML !== html) el.innerHTML = html;
    });
    (root || document).querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var orig = attrOriginals.get(el) || {};
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var p = pair.split(":"), attr = p[0], key = p[1];
        el.setAttribute(attr, lang === "es" && ES[key] != null ? ES[key] : (orig[attr] || ""));
      });
    });
    document.documentElement.lang = lang;
  }

  function t(key, vars) {
    var s = (UI[lang] && UI[lang][key]) || UI.en[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, v) { return vars[v] != null ? vars[v] : ""; });
    return s;
  }

  window.i18n = {
    get lang() { return lang; },
    get locale() { return lang === "es" ? "es-US" : "en-US"; },
    t: t,
    apply: apply,
    set: function (l) {
      lang = l === "es" ? "es" : "en";
      save(lang);
      apply();
      document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: lang } }));
    }
  };

  capture();
  if (lang === "es") apply();
  document.documentElement.lang = lang;
})();
