/* ==========================================================================
   Online booking wizard + automatic replies
   --------------------------------------------------------------------------
   Sends to Google Apps Script (recommended: live availability, Google Calendar,
   branded auto-reply email, photos, reminders) when SITE.booking.appsScriptUrl
   is set; otherwise falls back to FormSubmit.co (email to the owner + automatic
   reply to the customer). See README.md.
   ========================================================================== */
(function () {
  "use strict";
  var SITE = window.SITE, CFG = SITE.booking, B = SITE.business;
  var root = document.querySelector("[data-booking]");
  if (!root) return;

  var form = root.querySelector("[data-booking-form]");
  var $ = function (s) { return root.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var t = function (k, v) { return window.i18n.t(k, v); };
  var esc = window.JSH.esc, icon = window.JSH.icon;
  var hasBackend = !!CFG.appsScriptUrl;

  var state = { step: 1, services: [], date: null, time: null, month: null, busy: new Set(), closed: new Set(), photos: [], last: null, sending: false };

  /* ---------- Date helpers (all wall-clock times in the business time zone) ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function nowBiz() {
    try {
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: CFG.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      return new Date(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute);
    } catch (e) { return new Date(); }
  }
  function today() { var n = nowBiz(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function lastDay() { var d = today(); d.setDate(d.getDate() + CFG.daysAhead); return d; }
  function slotsFor(ds) { return parseYmd(ds).getDay() === 6 && CFG.saturdaySlots ? CFG.saturdaySlots : CFG.slots; }
  function slotDate(ds, tm) { var d = parseYmd(ds), hm = tm.split(":"); d.setHours(+hm[0], +hm[1], 0, 0); return d; }
  function isClosed(ds) {
    return CFG.closedWeekdays.indexOf(parseYmd(ds).getDay()) !== -1 || CFG.blackoutDates.indexOf(ds) !== -1 || state.closed.has(ds);
  }
  function slotOpen(ds, tm) {
    var earliest = new Date(nowBiz().getTime() + CFG.minLeadHours * 3600e3);
    return slotDate(ds, tm) >= earliest && !state.busy.has(ds + " " + tm);
  }
  function dayOpen(ds) {
    if (isClosed(ds) || parseYmd(ds) > lastDay()) return false;
    return slotsFor(ds).some(function (tm) { return slotOpen(ds, tm); });
  }
  function nextAvailable() {
    var d = today();
    for (var i = 0; i <= CFG.daysAhead; i++) {
      var ds = ymd(d);
      if (!isClosed(ds)) {
        var list = slotsFor(ds);
        for (var j = 0; j < list.length; j++) if (slotOpen(ds, list[j])) return { date: ds, time: list[j] };
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  }
  function fmtDate(ds, opts) { return parseYmd(ds).toLocaleDateString(window.i18n.locale, opts || { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
  function fmtTime(tm) { var hm = tm.split(":"); return new Date(2000, 0, 1, +hm[0], +hm[1]).toLocaleTimeString(window.i18n.locale, { hour: "numeric", minute: "2-digit" }); }
  function serviceNames(lang) {
    lang = lang || window.i18n.lang;
    return state.services.map(function (id) { var s = SITE.services.filter(function (x) { return x.id === id; })[0]; return s ? s[lang] : id; }).join(", ");
  }

  /* ---------- Availability from the backend (optional) ---------- */
  var availPromise = null;
  function loadAvailability(force) {
    if (!hasBackend) return Promise.resolve();
    if (availPromise && !force) return availPromise;
    availPromise = timeoutFetch(CFG.appsScriptUrl + "?action=availability&_=" + Date.now(), {}, 12000)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) { state.busy = new Set(j.busy || []); state.closed = new Set(j.closedDates || []); }
      })
      .catch(function () { /* schedule rules still apply */ });
    return availPromise;
  }
  function timeoutFetch(url, opts, ms) {
    var ctrl = "AbortController" in window ? new AbortController() : null;
    if (ctrl) opts.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }

  /* ---------- Step 1: services ---------- */
  function renderServices() {
    var box = $("[data-service-options]");
    box.innerHTML = "";
    SITE.services.forEach(function (s) {
      var label = document.createElement("label");
      label.className = "svc-opt";
      label.innerHTML = '<input type="checkbox" name="services" value="' + s.id + '"><span class="svc-opt-ic">' + icon(s.icon) + "</span><span>" + esc(s[window.i18n.lang]) + "</span>";
      var cb = label.querySelector("input");
      cb.checked = state.services.indexOf(s.id) !== -1;
      label.classList.toggle("is-checked", cb.checked);
      cb.addEventListener("change", function () {
        if (cb.checked) { if (state.services.indexOf(s.id) === -1) state.services.push(s.id); }
        else state.services = state.services.filter(function (x) { return x !== s.id; });
        label.classList.toggle("is-checked", cb.checked);
        hideErr("services");
      });
      box.appendChild(label);
    });
  }

  /* ---------- Step 2: calendar + time slots ---------- */
  function renderCalendar() {
    var m = state.month;
    $("[data-cal-title]").textContent = m.toLocaleDateString(window.i18n.locale, { month: "long", year: "numeric" });
    $("[data-cal-prev]").setAttribute("aria-label", t("cal.prev"));
    $("[data-cal-next]").setAttribute("aria-label", t("cal.next"));
    var dow = $("[data-cal-dow]"); dow.innerHTML = "";
    for (var i = 0; i < 7; i++) {
      var sp = document.createElement("span");
      sp.textContent = new Date(2023, 0, 1 + i).toLocaleDateString(window.i18n.locale, { weekday: "short" }).replace(".", "");
      dow.appendChild(sp);
    }
    var grid = $("[data-cal-grid]"); grid.innerHTML = "";
    var y = m.getFullYear(), mo = m.getMonth(), lead = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    for (i = 0; i < lead; i++) { var e = document.createElement("span"); e.className = "cal-day is-empty"; grid.appendChild(e); }
    var todayStr = ymd(today());
    for (var d = 1; d <= days; d++) {
      var ds = ymd(new Date(y, mo, d));
      var b = document.createElement("button");
      b.type = "button"; b.className = "cal-day" + (ds === todayStr ? " is-today" : "");
      b.textContent = d; b.dataset.date = ds;
      b.disabled = !dayOpen(ds);
      b.setAttribute("aria-pressed", String(state.date === ds));
      b.setAttribute("aria-label", fmtDate(ds));
      b.addEventListener("click", selectDate.bind(null, ds));
      grid.appendChild(b);
    }
    var t0 = today(), last = lastDay();
    $("[data-cal-prev]").disabled = y < t0.getFullYear() || (y === t0.getFullYear() && mo <= t0.getMonth());
    $("[data-cal-next]").disabled = y > last.getFullYear() || (y === last.getFullYear() && mo >= last.getMonth());
  }
  function selectDate(ds) {
    state.date = ds; state.time = null;
    renderCalendar(); renderSlots(); hideErr("slot");
  }
  function renderSlots() {
    var box = $("[data-slots]"), title = $("[data-slots-title]");
    box.innerHTML = "";
    if (!state.date) { title.textContent = t("slots.pick"); return; }
    var any = false;
    slotsFor(state.date).forEach(function (tm) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "slot"; b.textContent = fmtTime(tm);
      var open = slotOpen(state.date, tm); any = any || open;
      b.disabled = !open;
      b.setAttribute("aria-pressed", String(state.time === tm));
      b.addEventListener("click", function () { state.time = tm; renderSlots(); hideErr("slot"); });
      box.appendChild(b);
    });
    title.textContent = any ? t("slots.for", { date: fmtDate(state.date, { weekday: "long", month: "long", day: "numeric" }) }) : t("slots.none");
  }
  root.querySelector("[data-cal-prev]").addEventListener("click", function () { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); });
  root.querySelector("[data-cal-next]").addEventListener("click", function () { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); });

  /* ---------- Step 3: photos (Apps Script backend only) ---------- */
  var photoInput = $("[data-photo-input]");
  if (hasBackend) { $("[data-photo-field]").hidden = false; $("[data-photo-alt-hint]").hidden = true; }
  function compress(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }
  function renderThumbs() {
    var box = $("[data-photo-thumbs]"); box.innerHTML = "";
    state.photos.forEach(function (p, i) {
      var d = document.createElement("div"); d.className = "thumb";
      d.innerHTML = '<img src="' + p.preview + '" alt=""><button type="button" aria-label="' + esc(t("photos.remove")) + '">' + icon("i-x") + "</button>";
      d.querySelector("button").addEventListener("click", function () { state.photos.splice(i, 1); renderThumbs(); });
      box.appendChild(d);
    });
  }
  photoInput.addEventListener("change", function () {
    var files = Array.prototype.slice.call(photoInput.files || []);
    var room = CFG.maxPhotos - state.photos.length;
    if (files.length > room) setStatus(t("photos.max", { n: CFG.maxPhotos }), true);
    files.slice(0, Math.max(0, room)).forEach(function (f) {
      compress(f).then(function (dataUrl) {
        state.photos.push({ name: f.name.replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl });
        renderThumbs();
      }).catch(function () {});
    });
    photoInput.value = "";
  });

  /* ---------- Validation ---------- */
  function showErr(key, input) {
    var e = root.querySelector('[data-error-for="' + key + '"]'); if (e) e.hidden = false;
    if (input) input.setAttribute("aria-invalid", "true");
  }
  function hideErr(key, input) {
    var e = root.querySelector('[data-error-for="' + key + '"]'); if (e) e.hidden = true;
    if (input) input.removeAttribute("aria-invalid");
  }
  function phoneDigits() {
    var d = form.phone.value.replace(/\D/g, "");
    return d.length === 11 && d.charAt(0) === "1" ? d.slice(1) : d;
  }
  function validate(step) {
    var bad = [];
    if (step === 1 && !state.services.length) { showErr("services"); bad.push(null); }
    if (step === 2 && (!state.date || !state.time)) { showErr("slot"); bad.push(null); }
    if (step === 3) {
      if (form.details.value.trim().length < 10) { showErr("details", form.details); bad.push(form.details); }
      if (!/^\d{5}$/.test(form.zip.value.trim())) { showErr("zip", form.zip); bad.push(form.zip); }
    }
    if (step === 4) {
      if (form.name.value.trim().length < 2) { showErr("name", form.name); bad.push(form.name); }
      if (phoneDigits().length !== 10) { showErr("phone", form.phone); bad.push(form.phone); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim())) { showErr("email", form.email); bad.push(form.email); }
    }
    var first = bad.filter(Boolean)[0]; if (first) first.focus();
    return bad.length === 0;
  }
  ["details", "zip", "name", "phone", "email"].forEach(function (n) {
    form[n].addEventListener("input", function () { hideErr(n, form[n]); });
  });
  form.zip.addEventListener("input", function () { form.zip.value = form.zip.value.replace(/\D/g, "").slice(0, 5); });
  form.phone.addEventListener("blur", function () {
    var d = phoneDigits();
    if (d.length === 10) form.phone.value = "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  });

  /* ---------- Step navigation ---------- */
  var btnBack = $("[data-back]"), btnNext = $("[data-next]"), btnSubmit = $("[data-submit]");
  function go(step, opts) {
    state.step = step;
    $$(".bstep").forEach(function (fs) { fs.classList.toggle("is-active", +fs.dataset.step === step); });
    $("[data-progress]").style.width = (step / 4) * 100 + "%";
    $$("[data-progress-steps] li").forEach(function (li, i) {
      li.classList.toggle("is-active", i + 1 === step);
      li.classList.toggle("is-done", i + 1 < step);
    });
    btnBack.hidden = step === 1;
    btnNext.hidden = step === 4;
    btnSubmit.hidden = step !== 4;
    if (step === 4) renderSummary();
    setStatus("");
    if (!opts || !opts.quiet) {
      var r = root.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) root.scrollIntoView({ behavior: "smooth", block: "start" });
      var fs = root.querySelector('.bstep[data-step="' + step + '"]');
      fs.setAttribute("tabindex", "-1"); fs.focus({ preventScroll: true });
    }
  }
  btnNext.addEventListener("click", function () { if (validate(state.step)) go(state.step + 1); });
  btnBack.addEventListener("click", function () { go(state.step - 1); });

  function renderSummary() {
    var where = (form.address.value.trim() ? form.address.value.trim() + ", " : "") + form.zip.value.trim();
    $("[data-summary]").innerHTML =
      "<h4>" + esc(t("sum.title")) + "</h4><dl>" +
      "<dt>" + esc(t("sum.services")) + "</dt><dd>" + esc(serviceNames()) + "</dd>" +
      "<dt>" + esc(t("sum.when")) + "</dt><dd>" + esc(fmtDate(state.date) + " · " + fmtTime(state.time)) + " ET</dd>" +
      "<dt>" + esc(t("sum.where")) + "</dt><dd>" + esc(where) + "</dd></dl>";
  }

  function setStatus(msg, isInfo) {
    var s = $("[data-form-status]");
    s.textContent = msg; s.hidden = !msg;
    s.classList.toggle("is-info", !!isInfo);
  }

  /* ---------- Submit ---------- */
  function makeRef() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out = "", bytes;
    try { bytes = crypto.getRandomValues(new Uint8Array(6)); } catch (e) { bytes = [1, 2, 3, 4, 5, 6].map(function () { return Math.random() * 255; }); }
    for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(bytes[i]) % chars.length);
    return "JS-" + out;
  }
  function methodLabel(m, lang) {
    var L = { en: { Text: "text message", Call: "phone", Email: "email", WhatsApp: "WhatsApp" }, es: { Text: "mensaje de texto", Call: "teléfono", Email: "correo", WhatsApp: "WhatsApp" } };
    return (L[lang || window.i18n.lang] || L.en)[m] || m;
  }

  function buildData() {
    var lang = window.i18n.lang;
    var checked = function (name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; };
    return {
      type: "booking",
      ref: makeRef(),
      lang: lang,
      services: state.services.slice(),
      serviceNames: serviceNames("en"),
      serviceNamesLocal: serviceNames(lang),
      date: state.date,
      time: state.time,
      dateLabel: fmtDate(state.date),
      timeLabel: fmtTime(state.time),
      details: form.details.value.trim(),
      zip: form.zip.value.trim(),
      address: form.address.value.trim(),
      propertyType: form.propertyType.value,
      timeline: checked("timeline"),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      contactMethod: checked("contactMethod"),
      photos: state.photos.map(function (p) { return { name: p.name, type: p.type, data: p.data }; }),
      website: form.website.value, // honeypot
      page: location.href,
      submittedAt: new Date().toISOString()
    };
  }

  function autoReplyText(d) {
    var first = d.name.split(" ")[0];
    if (d.lang === "es") {
      return "¡Hola " + first + "! Gracias por reservar con J Sanchez Home Improvements.\n\n" +
        "Recibimos su solicitud:\n" +
        "• Confirmación n.º: " + d.ref + "\n• Servicios: " + d.serviceNamesLocal + "\n" +
        "• Visita solicitada: " + d.dateLabel + ", " + d.timeLabel + " (hora del Este)\n• Código postal: " + d.zip + "\n\n" +
        "Próximo paso: revisaremos su solicitud y lo contactaremos por " + methodLabel(d.contactMethod, "es") + " para confirmar su visita (o sugerirle otro horario si es necesario).\n\n" +
        "¿Tiene fotos del proyecto? Envíelas por mensaje al " + B.phone + "; nos ayudan a prepararnos.\n\n" +
        "¿Necesita cambiar algo? Responda a este correo o llame/escriba al " + B.phone + ".\n\n" +
        B.name + "\nSu hogar, nuestro compromiso";
    }
    return "Hi " + first + ", thanks for booking with J Sanchez Home Improvements!\n\n" +
      "We received your request:\n" +
      "• Confirmation #: " + d.ref + "\n• Services: " + d.serviceNames + "\n" +
      "• Requested visit: " + d.dateLabel + " at " + d.timeLabel + " (Eastern Time)\n• ZIP code: " + d.zip + "\n\n" +
      "What happens next: we'll review your request and reach out by " + methodLabel(d.contactMethod, "en") + " to confirm your visit (or suggest another time if needed).\n\n" +
      "Have photos of the project? Text them to " + B.phone + " — it helps us prepare.\n\n" +
      "Need to change something? Just reply to this email or call/text " + B.phone + ".\n\n" +
      B.name + "\nYour Home, Our Commitment";
  }

  function sendAppsScript(d) {
    // text/plain body = "simple" CORS request (no preflight), which Apps Script accepts
    return timeoutFetch(CFG.appsScriptUrl, { method: "POST", body: JSON.stringify(d) }, 45000)
      .then(function (r) { return r.json(); });
  }
  function sendFormSubmit(d) {
    var body = {
      name: d.name, email: d.email, phone: d.phone,
      "Confirmation #": d.ref, "Services": d.serviceNames,
      "Requested date": d.dateLabel, "Requested time": d.timeLabel + " (ET)",
      "Preferred contact": d.contactMethod, "Language": d.lang === "es" ? "Spanish" : "English",
      "ZIP": d.zip, "Address": d.address || "—", "Property": d.propertyType, "Start": d.timeline,
      "Project details": d.details,
      _subject: "New booking " + d.ref + " · " + d.serviceNames + " · " + d.dateLabel + " " + d.timeLabel,
      _template: "table", _captcha: "false", _replyto: d.email,
      _autoresponse: autoReplyText(d),
      _honey: d.website
    };
    return timeoutFetch("https://formsubmit.co/ajax/" + encodeURIComponent(CFG.formsubmitEmail), {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body)
    }, 25000).then(function (r) { return r.json(); }).then(function (j) {
      return { ok: j && (j.success === true || j.success === "true"), ref: d.ref, error: j && j.message };
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (state.step < 4) { if (validate(state.step)) go(state.step + 1); return; }
    if (state.sending || !validate(4)) return;
    var d = buildData();
    state.sending = true; btnSubmit.disabled = true; btnBack.disabled = true;
    setStatus(t("status.sending"), true);
    var send = hasBackend ? sendAppsScript(d) : CFG.formsubmitEmail ? sendFormSubmit(d) : Promise.reject(new Error("No booking backend configured"));
    send.then(function (res) {
      if (res && res.ok) { d.ref = res.ref || d.ref; showSuccess(d); return; }
      if (res && res.error === "slot_taken") {
        return loadAvailability(true).then(function () {
          state.time = null; go(2); renderCalendar(); renderSlots(); setStatus(t("status.taken"));
        });
      }
      throw new Error((res && res.error) || "Booking failed");
    }).catch(function (err) {
      if (window.console) console.error("Booking error:", err);
      setStatus(t("status.error"));
    }).finally(function () {
      state.sending = false; btnSubmit.disabled = false; btnBack.disabled = false;
    });
  });

  /* ---------- Success screen ---------- */
  var success = $("[data-booking-success]");
  function eventTimes(d) {
    var s = slotDate(d.date, d.time), e = new Date(s.getTime() + CFG.visitMinutes * 60000);
    var f = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + "T" + pad(x.getHours()) + pad(x.getMinutes()) + "00"; };
    return { start: f(s), end: f(e) };
  }
  function eventLocation(d) { return (d.address ? d.address + ", " : "") + d.zip; }
  function gcalUrl(d) {
    var tt = eventTimes(d);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(t("event.title")) +
      "&dates=" + tt.start + "/" + tt.end + "&ctz=" + encodeURIComponent(CFG.timezone) +
      "&details=" + encodeURIComponent(t("event.desc", { ref: d.ref, services: d.serviceNamesLocal })) +
      "&location=" + encodeURIComponent(eventLocation(d));
  }
  function icsText(d) {
    var tt = eventTimes(d), now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    var x = function (s) { return String(s).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); };
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//J Sanchez Home Improvements//Booking//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE", "TZID:America/New_York",
      "BEGIN:DAYLIGHT", "TZOFFSETFROM:-0500", "TZOFFSETTO:-0400", "TZNAME:EDT", "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU", "END:DAYLIGHT",
      "BEGIN:STANDARD", "TZOFFSETFROM:-0400", "TZOFFSETTO:-0500", "TZNAME:EST", "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU", "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT", "UID:" + d.ref + "@jsanchez-home-improvements", "DTSTAMP:" + now,
      "DTSTART;TZID=" + CFG.timezone + ":" + tt.start, "DTEND;TZID=" + CFG.timezone + ":" + tt.end,
      "SUMMARY:" + x(t("event.title")), "DESCRIPTION:" + x(t("event.desc", { ref: d.ref, services: d.serviceNamesLocal })),
      "LOCATION:" + x(eventLocation(d)),
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:" + x(t("event.title")), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR", ""
    ].join("\r\n");
  }
  function fillSuccess(d) {
    success.querySelector("[data-ok-ref]").textContent = d.ref;
    success.querySelector("[data-ok-when]").textContent = fmtDate(d.date) + " · " + fmtTime(d.time) + " ET";
    success.querySelector("[data-ok-msg]").textContent = t("ok.msg", { email: d.email, method: methodLabel(d.contactMethod) });
    success.querySelector("[data-ok-gcal]").href = gcalUrl(d);
    success.querySelector("[data-ok-sms]").href = window.JSH.smsHref(t("sms.body", { ref: d.ref }));
  }
  function showSuccess(d) {
    state.last = d;
    fillSuccess(d);
    form.hidden = true;
    $(".progress").hidden = true; $("[data-progress-steps]").hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
    root.scrollIntoView({ behavior: "smooth", block: "start" });
    state.busy.add(d.date + " " + d.time);
    updateNext();
  }
  success.querySelector("[data-ok-ics]").addEventListener("click", function () {
    if (!state.last) return;
    var blob = new Blob([icsText(state.last)], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "j-sanchez-estimate-" + state.last.ref + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  function reset() {
    form.reset(); state.services = []; state.date = null; state.time = null; state.photos = []; state.last = null;
    renderThumbs(); renderServices(); renderCalendar(); renderSlots();
    success.hidden = true; form.hidden = false;
    $(".progress").hidden = false; $("[data-progress-steps]").hidden = false;
    $$("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    $$(".field-error").forEach(function (el) { el.hidden = true; });
    go(1);
  }
  success.querySelector("[data-ok-again]").addEventListener("click", reset);

  /* ---------- Entry points from the rest of the page ---------- */
  function preselect(id) {
    if (!success.hidden) reset();
    if (id && state.services.indexOf(id) === -1) state.services.push(id);
    renderServices(); hideErr("services");
    if (state.step === 1) go(2, { quiet: true });
    // phones: jump straight to the form; desktop: show the whole section
    var target = window.matchMedia("(max-width: 960px)").matches ? root : document.getElementById("book");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-book-service]").forEach(function (b) {
    b.addEventListener("click", function () { preselect(b.getAttribute("data-book-service")); });
  });

  function updateNext() {
    var el = document.querySelector("[data-next-slot]"); if (!el) return;
    var n = nextAvailable();
    el.textContent = n ? fmtDate(n.date, { weekday: "short", month: "short", day: "numeric" }) + " · " + fmtTime(n.time) : t("next.none");
  }
  var nextTile = document.querySelector(".tile-next");
  if (nextTile) nextTile.addEventListener("click", function () {
    var n = nextAvailable(); if (!n || !success.hidden) return;
    state.date = n.date; state.time = n.time;
    var d = parseYmd(n.date); state.month = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar(); renderSlots();
  });

  window.Booking = { preselect: preselect, nextAvailable: nextAvailable, open: function () { document.getElementById("book").scrollIntoView({ behavior: "smooth" }); } };

  /* ---------- Shared sender for quick messages (used by the chat assistant) ---------- */
  window.JSHSend = {
    message: function (m) {
      var data = { type: "message", lang: window.i18n.lang, name: m.name, phone: m.phone, email: m.email || "", message: m.message, website: m.website || "", page: location.href, submittedAt: new Date().toISOString() };
      if (hasBackend) return sendAppsScript(data).then(function (r) { return !!(r && r.ok); });
      if (!CFG.formsubmitEmail) return Promise.resolve(false);
      var body = {
        name: data.name, phone: data.phone, email: data.email || "(not provided)", "Message": data.message,
        "Language": data.lang === "es" ? "Spanish" : "English",
        _subject: "Website question from " + data.name, _template: "table", _captcha: "false", _honey: data.website
      };
      if (data.email) {
        body._replyto = data.email;
        body._autoresponse = data.lang === "es"
          ? "¡Gracias, " + data.name.split(" ")[0] + "! Recibimos su mensaje y le responderemos pronto. Si es urgente, llame o escriba al " + B.phone + ".\n\n" + B.name
          : "Thanks, " + data.name.split(" ")[0] + "! We got your message and will get back to you soon. If it's urgent, call or text " + B.phone + ".\n\n" + B.name;
      }
      return timeoutFetch("https://formsubmit.co/ajax/" + encodeURIComponent(CFG.formsubmitEmail), {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body)
      }, 25000).then(function (r) { return r.json(); }).then(function (j) { return !!(j && (j.success === true || j.success === "true")); });
    }
  };

  /* ---------- Init ---------- */
  var tdy = today();
  state.month = new Date(tdy.getFullYear(), tdy.getMonth(), 1);
  // If nothing is bookable this month (e.g. last days of the month), start on next month
  var na = nextAvailable();
  if (na) { var nd = parseYmd(na.date); state.month = new Date(nd.getFullYear(), nd.getMonth(), 1); }
  renderServices(); renderCalendar(); renderSlots(); go(1, { quiet: true }); updateNext();
  loadAvailability().then(function () { renderCalendar(); renderSlots(); updateNext(); });

  document.addEventListener("langchange", function () {
    renderServices(); renderCalendar(); renderSlots(); updateNext(); renderThumbs();
    if (state.step === 4) renderSummary();
    if (state.last && !success.hidden) fillSuccess(state.last);
  });
})();
