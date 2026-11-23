/* ==========================================================================
   Auto-reply assistant
   Answers common questions instantly (English / Spanish), sends people to
   the booking form, and collects a callback request when it can't answer.
   No AI service or API key needed — edit the answers in KB below.
   ========================================================================== */
(function () {
  "use strict";
  var SITE = window.SITE, B = SITE.business;
  var wrap = document.querySelector("[data-chat]");
  if (!wrap) return;
  var panel = wrap.querySelector(".chat-panel"), log = wrap.querySelector("[data-chat-log]"),
    quick = wrap.querySelector("[data-chat-quick]"), formEl = wrap.querySelector("[data-chat-form]"),
    input = wrap.querySelector("[data-chat-text]"), launcher = wrap.querySelector("[data-chat-open]");
  var esc = window.JSH.esc;
  var lang = function () { return window.i18n.lang; };
  var tel = '<a href="tel:' + B.phoneE164 + '">' + B.phone + "</a>";
  var mail = '<a href="mailto:' + B.email + '">' + B.email + "</a>";
  var wa = '<a href="https://wa.me/' + B.whatsapp + '" target="_blank" rel="noopener">WhatsApp</a>';

  /* ---------- Knowledge base ---------- */
  // kw: words or phrases to look for (accents and capitals are ignored)
  var KB = [
    { id: "emergency", kw: ["emergency", "urgent", "flood", "burst", "leaking now", "no power", "sparks", "emergencia", "urgente", "inundacion", "inundado", "se reviento", "chispas"],
      en: "For anything urgent, please call " + tel + " right away so we can see how fast we can help. If water is actively leaking, shut off the main water valve first. If you smell burning or see sparks, turn off the breaker and call 911 if needed.",
      es: "Si es urgente, llame de inmediato al " + tel + " para ver qué tan rápido podemos ayudarle. Si hay una fuga activa, cierre primero la llave de paso principal. Si huele a quemado o ve chispas, apague el breaker y llame al 911 si es necesario.",
      quick: ["call"] },
    { id: "bathroom", svc: "bathroom", kw: ["bath", "bathroom", "shower", "tub", "vanity", "toilet room", "bano", "banos", "ducha", "banera", "tocador"],
      en: "Bathroom remodels are one of our specialties — walk-in showers, tub conversions, tile, vanities, glass and fixtures. Want to book an estimate visit?",
      es: "Las remodelaciones de baños son una de nuestras especialidades: duchas walk-in, conversión de bañeras, azulejos, tocadores, mamparas y grifería. ¿Quiere reservar una visita de estimado?" },
    { id: "kitchen", svc: "kitchen", kw: ["kitchen", "cabinet", "countertop", "counter top", "backsplash", "island", "cocina", "gabinete", "encimera", "meseta", "salpicadero", "isla"],
      en: "We love kitchen projects — cabinets, countertops, backsplashes, islands, lighting and hardware. Want to book an estimate visit?",
      es: "Nos encantan los proyectos de cocina: gabinetes, encimeras, salpicaderos, islas, iluminación y herrajes. ¿Quiere reservar una visita de estimado?" },
    { id: "flooring", svc: "flooring", kw: ["floor", "flooring", "tile", "vinyl", "laminate", "hardwood", "baseboard", "piso", "pisos", "loza", "losa", "ceramica", "porcelanato", "vinil", "laminado", "zocalo"],
      en: "Yes, we install flooring — porcelain and ceramic tile, luxury vinyl plank, laminate and wood, including leveling and baseboards. Want to book an estimate visit?",
      es: "Sí, instalamos pisos: porcelanato y cerámica, vinil de lujo, laminado y madera, incluyendo nivelación y zócalos. ¿Quiere reservar una visita de estimado?" },
    { id: "ceiling", svc: "ceiling", kw: ["ceiling", "popcorn", "drywall", "water stain", "techo", "cielo raso", "cielorraso", "popcorn", "tablaroca", "mancha de agua"],
      en: "We do ceiling work — popcorn removal, drywall repair and texture, water-damage patching and smooth finishes. Want to book an estimate visit?",
      es: "Hacemos trabajos de techo: remoción de popcorn, reparación y textura de drywall, parches por daños de agua y acabados lisos. ¿Quiere reservar una visita de estimado?" },
    { id: "painting", svc: "painting", kw: ["paint", "painting", "painter", "repaint", "pintura", "pintar", "pintor"],
      en: "We do interior painting — walls, ceilings, trim, doors and cabinets, with careful prep and cleanup. Want to book an estimate visit?",
      es: "Hacemos pintura interior: paredes, techos, molduras, puertas y gabinetes, con preparación cuidadosa y limpieza. ¿Quiere reservar una visita de estimado?" },
    { id: "plumbing", svc: "plumbing", kw: ["plumb", "plumbing", "plumber", "leak", "faucet", "toilet", "sink", "drain", "pipe", "disposal", "water heater", "plomero", "plomeria", "fuga", "grifo", "llave de agua", "inodoro", "lavamanos", "fregadero", "tuberia", "desague", "triturador"],
      en: "We handle plumbing jobs like faucets, sinks, toilets, leaks and fixture upgrades. Want to book a visit? If something is leaking right now, call " + tel + ".",
      es: "Hacemos trabajos de plomería como grifos, lavamanos, inodoros, fugas y cambio de accesorios. ¿Quiere reservar una visita? Si algo está goteando ahora mismo, llame al " + tel + "." },
    { id: "electrical", svc: "electrical", kw: ["electric", "electrical", "electrician", "outlet", "switch", "light fixture", "lighting", "ceiling fan", "fan", "wiring", "recessed", "electrico", "electricista", "electricidad", "tomacorriente", "enchufe", "interruptor", "lampara", "ventilador", "luces"],
      en: "We install light fixtures, ceiling fans, outlets, switches and recessed or under-cabinet lighting. Want to book a visit?",
      es: "Instalamos lámparas, ventiladores de techo, tomacorrientes, interruptores y luces empotradas o bajo gabinete. ¿Quiere reservar una visita?" },
    { id: "price", kw: ["price", "cost", "how much", "quote", "estimate", "rate", "charge", "budget", "cheap", "precio", "costo", "cuanto", "cotizacion", "presupuesto", "estimado", "cobran", "barato"],
      en: "Every project is different, so we give you a clear written estimate after a quick visit to see the space and take measurements. You can book that visit online in about a minute.",
      es: "Cada proyecto es diferente, así que le damos un estimado claro por escrito después de una visita rápida para ver el espacio y tomar medidas. Puede reservar esa visita en línea en un minuto.",
      quick: ["book"] },
    { id: "book", kw: ["book", "appointment", "schedule", "visit", "available", "availability", "come out", "come by", "reserv", "cita", "agendar", "programar", "disponib", "visita"],
      en: "You can book right here — pick your service and a time, and you'll get an instant email confirmation. Taking you to the booking form now.",
      es: "Puede reservar aquí mismo: elija su servicio y un horario, y recibirá una confirmación inmediata por correo. Lo llevo al formulario de reserva.",
      action: "book" },
    { id: "hours", kw: ["hour", "hours", "open", "close", "closing", "weekend", "saturday", "sunday", "horario", "abren", "cierran", "sabado", "domingo", "fin de semana"],
      en: function () { return "Our hours are " + B.hours.en + ". Online booking is open 24/7."; },
      es: function () { return "Nuestro horario es " + B.hours.es + ". Las reservas en línea están abiertas 24/7."; } },
    { id: "area", kw: ["area", "serve", "where", "city", "cities", "location", "located", "broward", "lauderdale", "hollywood", "pembroke", "miramar", "coral springs", "davie", "plantation", "weston", "zona", "ciudad", "donde", "ubicad"],
      en: function () { return "We serve " + B.area + " — including " + B.cities.slice(0, 8).join(", ") + " and nearby cities. Not sure about your address? Book anyway or send us your ZIP code and we'll confirm."; },
      es: function () { return "Trabajamos en el condado de Broward, incluyendo " + B.cities.slice(0, 8).join(", ") + " y ciudades cercanas. ¿No está seguro de su zona? Reserve de todos modos o envíenos su código postal y le confirmamos."; } },
    { id: "spanish", kw: ["spanish", "espanol", "habla", "hablan"],
      en: "¡Sí! Se habla español. Tap below to see the whole site in Spanish.",
      es: "¡Sí! Se habla español. Ya está viendo el sitio en español.",
      quick: ["es"] },
    { id: "photos", kw: ["photo", "picture", "pic", "image", "video", "foto", "imagen"],
      en: "Photos help a lot! Attach them when you book online, or text them to " + tel + ". You can also see finished jobs in our gallery.",
      es: "¡Las fotos ayudan mucho! Adjúntelas al reservar en línea o envíelas por mensaje al " + tel + ". También puede ver trabajos terminados en nuestra galería." },
    { id: "small", kw: ["small job", "small repair", "minor", "handyman", "little job", "repair", "fix", "trabajo pequeno", "reparacion", "arreglo", "arreglar"],
      en: "Yes — no job is too small. We do everything from a single repair to a full remodel. Tell us what needs fixing and book a visit.",
      es: "Sí, ningún trabajo es demasiado pequeño. Hacemos desde una sola reparación hasta una remodelación completa. Cuéntenos qué necesita y reserve una visita.",
      quick: ["book"] },
    { id: "license", kw: ["license", "licensed", "insured", "insurance", "bonded", "permit", "licencia", "licenciado", "seguro", "asegurado", "permiso"],
      en: function () { return B.licenseNumber ? "Yes — our Florida license number is " + B.licenseNumber + ". Ask us about insurance and permits for your project at " + tel + "." : "Good question — please ask us directly at " + tel + " and we'll go over licensing, insurance and permits for your specific project."; },
      es: function () { return B.licenseNumber ? "Sí, nuestro número de licencia de Florida es " + B.licenseNumber + ". Pregúntenos sobre seguros y permisos para su proyecto al " + tel + "." : "Buena pregunta: consúltenos directamente al " + tel + " y le explicamos licencias, seguros y permisos para su proyecto."; } },
    { id: "payment", kw: ["pay", "payment", "card", "cash", "zelle", "financ", "deposit", "pago", "pagar", "tarjeta", "efectivo", "deposito"],
      en: "We'll go over payment options and the schedule with your written estimate.",
      es: "Le explicaremos las opciones de pago y el calendario junto con su estimado por escrito." },
    { id: "contact", kw: ["call", "phone", "number", "text", "whatsapp", "email", "contact", "talk", "human", "person", "someone", "real person", "llamar", "telefono", "numero", "correo", "hablar", "persona", "alguien", "contacto"],
      en: "Call or text " + tel + ", message us on " + wa + ", or email " + mail + ". Or leave your number here and we'll reach out.",
      es: "Llame o escriba al " + tel + ", envíenos un mensaje por " + wa + " o escriba a " + mail + ". O deje su número aquí y lo contactamos.",
      quick: ["leave"] },
    { id: "thanks", kw: ["thank", "thanks", "thx", "great", "awesome", "perfect", "gracias", "perfecto", "excelente"],
      en: "You're welcome! Anything else I can help with?",
      es: "¡Con gusto! ¿Algo más en lo que le pueda ayudar?" },
    { id: "greet", kw: ["hi", "hello", "hey", "good morning", "good afternoon", "hola", "buenas", "buenos dias", "buenas tardes"],
      en: "Hi there! What are you working on — a remodel, a repair, or something else?",
      es: "¡Hola! ¿En qué está trabajando: una remodelación, una reparación u otra cosa?" }
  ];

  var TXT = {
    en: {
      hello: "Hi! I'm the J Sanchez automated assistant. I can answer common questions instantly or help you book an estimate. What can I help with?",
      fallback: "I'm an automated assistant, so I may not have the answer to that. Leave your name and number and the J Sanchez team will get back to you — or call/text " + tel + ".",
      bookSvc: "Book {svc}", ask: "Leave your info", thanks: "Got it! We'll get back to you soon. If it's urgent, call or text " + tel + ".",
      fail: "Sorry, that didn't go through. Please call or text " + tel + ".",
      name: "Your name", phone: "Phone", email: "Email (optional)", msg: "How can we help?", send: "Send", invalid: "Please add your name and a valid phone number.",
      zip: "Thanks! We'll confirm coverage for {zip} when we get your request — we serve all of Broward County. Want to book a visit?",
      q: { services: "Services", book: "Book an estimate", price: "Pricing", hours: "Hours & area", call: "Call now", leave: "Talk to a person", es: "Ver en español", en: "View in English" }
    },
    es: {
      hello: "¡Hola! Soy el asistente automático de J Sanchez. Puedo responder preguntas comunes al instante o ayudarle a reservar un estimado. ¿En qué le ayudo?",
      fallback: "Soy un asistente automático y puede que no tenga esa respuesta. Deje su nombre y número y el equipo de J Sanchez lo contactará, o llame/escriba al " + tel + ".",
      bookSvc: "Reservar {svc}", ask: "Dejar mis datos", thanks: "¡Listo! Lo contactaremos pronto. Si es urgente, llame o escriba al " + tel + ".",
      fail: "Lo sentimos, no se pudo enviar. Llame o escriba al " + tel + ".",
      name: "Su nombre", phone: "Teléfono", email: "Correo (opcional)", msg: "¿Cómo le podemos ayudar?", send: "Enviar", invalid: "Agregue su nombre y un número de teléfono válido.",
      zip: "¡Gracias! Confirmaremos la cobertura para {zip} cuando recibamos su solicitud; trabajamos en todo el condado de Broward. ¿Quiere reservar una visita?",
      q: { services: "Servicios", book: "Reservar estimado", price: "Precios", hours: "Horario y zona", call: "Llamar ahora", leave: "Hablar con una persona", es: "Ver en español", en: "View in English" }
    }
  };
  var L = function () { return TXT[lang()]; };

  var SERVICES_TEXT = {
    en: function () { return "Here's what we do:\n• " + SITE.services.filter(function (s) { return s.id !== "other"; }).map(function (s) { return s.en; }).join("\n• ") + "\n…plus general repairs. What's your project?"; },
    es: function () { return "Esto es lo que hacemos:\n• " + SITE.services.filter(function (s) { return s.id !== "other"; }).map(function (s) { return s.es; }).join("\n• ") + "\n…y reparaciones en general. ¿Cuál es su proyecto?"; }
  };

  /* ---------- Matching ---------- */
  function norm(s) { return " " + String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ") + " "; }
  function score(text, entry) {
    var n = 0;
    entry.kw.forEach(function (k) {
      var nk = norm(k).trim();
      // whole-word match for short keywords, prefix match for longer stems
      if (nk.length <= 4 ? text.indexOf(" " + nk + " ") !== -1 : text.indexOf(" " + nk) !== -1) n += nk.split(" ").length;
    });
    return n;
  }
  function answer(raw) {
    var text = norm(raw);
    if (/\b(services?|servicios?|what do you do|que hacen|que ofrecen)\b/.test(text)) return { html: SERVICES_TEXT[lang()](), quick: ["book", "price"] };
    var zip = raw.match(/\b(3[234]\d{3})\b/);
    var best = null, bestScore = 0, svcHit = null;
    KB.forEach(function (e) {
      var s = score(text, e);
      if (e.svc && s > 0 && !svcHit) svcHit = e;
      if (s > bestScore) { best = e; bestScore = s; }
    });
    if (!best && zip) return { html: L().zip.replace("{zip}", zip[1]), quick: ["book"] };
    if (!best) return { html: L().fallback, form: raw, quick: ["call"] };
    var body = typeof best[lang()] === "function" ? best[lang()]() : best[lang()];
    var res = { html: body, quick: (best.quick || []).slice(), action: best.action };
    if (svcHit) res.quick.unshift("svc:" + svcHit.svc);
    else if (!best.action && best.id !== "thanks" && best.id !== "greet") res.quick.push("book");
    return res;
  }

  /* ---------- Rendering ---------- */
  function add(html, who) {
    var d = document.createElement("div");
    d.className = "msg msg-" + who;
    if (who === "user") d.textContent = html; else d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function typing() {
    var d = document.createElement("div");
    d.className = "msg msg-bot"; d.innerHTML = '<span class="msg-typing"><i></i><i></i><i></i></span>';
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }
  function svcLabel(id) { var s = SITE.services.filter(function (x) { return x.id === id; })[0]; return s ? s[lang()] : id; }
  function setQuick(keys) {
    quick.innerHTML = "";
    var seen = {};
    (keys || ["services", "book", "price", "hours", "leave"]).forEach(function (k) {
      if (seen[k]) return; seen[k] = 1;
      if (k === "es" && lang() === "es") return;
      var b = document.createElement("button"); b.type = "button";
      b.textContent = k.indexOf("svc:") === 0 ? L().bookSvc.replace("{svc}", svcLabel(k.slice(4))) : L().q[k];
      b.addEventListener("click", function () { quickAction(k, b.textContent); });
      quick.appendChild(b);
    });
  }
  function reply(res, delay) {
    var tp = typing();
    setTimeout(function () {
      tp.remove();
      add(res.html, "bot");
      if (res.form != null) leaveForm(res.form);
      setQuick(res.quick && res.quick.length ? res.quick : null);
      if (res.action === "book") goBook();
    }, delay || 650);
  }
  function goBook(svc) {
    setTimeout(function () {
      if (window.matchMedia("(max-width: 760px)").matches) close();
      if (svc && window.Booking) window.Booking.preselect(svc); else if (window.Booking) window.Booking.open();
    }, 700);
  }

  function quickAction(k, label) {
    add(label, "user");
    if (k === "call") { reply({ html: (lang() === "es" ? "Llámenos al " : "Call us at ") + tel + "." }); window.location.href = "tel:" + B.phoneE164; return; }
    if (k === "leave") { reply({ html: lang() === "es" ? "¡Claro! Déjenos sus datos y lo contactamos:" : "Sure! Leave your details and we'll reach out:", form: "" }); return; }
    if (k === "es" || k === "en") { window.i18n.set(k); reply({ html: L().hello }); return; }
    if (k === "book") { reply({ html: KB.filter(function (e) { return e.id === "book"; })[0][lang()] }); goBook(); return; }
    if (k.indexOf("svc:") === 0) {
      reply({ html: lang() === "es" ? "¡Perfecto! Ya marqué " + svcLabel(k.slice(4)) + " en el formulario de reserva." : "Great! I've selected " + svcLabel(k.slice(4)) + " in the booking form for you." });
      goBook(k.slice(4)); return;
    }
    if (k === "services") { reply({ html: SERVICES_TEXT[lang()](), quick: ["book", "price"] }); return; }
    if (k === "price") { reply(answer("price")); return; }
    if (k === "hours") {
      var h = KB.filter(function (e) { return e.id === "hours"; })[0][lang()](), a = KB.filter(function (e) { return e.id === "area"; })[0][lang()]();
      reply({ html: h + "\n\n" + a, quick: ["book"] }); return;
    }
  }

  function leaveForm(prefill) {
    var T = L();
    var f = document.createElement("form");
    f.className = "msg msg-bot msg-form"; f.noValidate = true;
    f.innerHTML =
      '<input name="name" autocomplete="name" placeholder="' + esc(T.name) + '" aria-label="' + esc(T.name) + '" maxlength="100">' +
      '<input name="phone" type="tel" autocomplete="tel" placeholder="' + esc(T.phone) + '" aria-label="' + esc(T.phone) + '" maxlength="20">' +
      '<input name="email" type="email" autocomplete="email" placeholder="' + esc(T.email) + '" aria-label="' + esc(T.email) + '" maxlength="120">' +
      '<textarea name="message" rows="2" placeholder="' + esc(T.msg) + '" aria-label="' + esc(T.msg) + '" maxlength="1000"></textarea>' +
      '<input name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
      '<button class="btn btn-gold" type="submit">' + esc(T.send) + "</button>";
    f.message.value = prefill || "";
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var digits = f.phone.value.replace(/\D/g, "");
      if (f.name.value.trim().length < 2 || digits.length < 10) { add(T.invalid, "bot"); return; }
      var btn = f.querySelector("button"); btn.disabled = true;
      window.JSHSend.message({ name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), message: f.message.value.trim() || "(callback request)", website: f.website.value })
        .then(function (ok) { if (ok) { f.remove(); add(T.thanks, "bot"); } else { btn.disabled = false; add(T.fail, "bot"); } })
        .catch(function () { btn.disabled = false; add(T.fail, "bot"); });
    });
    log.appendChild(f); log.scrollTop = log.scrollHeight;
  }

  /* ---------- Open / close ---------- */
  var started = false;
  function open() {
    panel.hidden = false; wrap.classList.add("is-open"); launcher.setAttribute("aria-expanded", "true");
    if (!started) { started = true; reply({ html: L().hello }, 400); }
    setTimeout(function () { if (!window.matchMedia("(max-width: 760px)").matches) input.focus(); }, 50);
  }
  function close() { panel.hidden = true; wrap.classList.remove("is-open"); launcher.setAttribute("aria-expanded", "false"); }
  launcher.addEventListener("click", function () { panel.hidden ? open() : close(); });
  wrap.querySelector("[data-chat-close]").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim(); if (!v) return;
    input.value = "";
    add(v, "user");
    reply(answer(v));
  });

  document.addEventListener("langchange", function () { if (started) setQuick(); });
  window.JSHChat = { open: open, close: close, answer: answer };
})();
