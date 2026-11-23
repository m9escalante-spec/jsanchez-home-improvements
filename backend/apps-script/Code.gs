/**
 * J Sanchez Home Improvements — booking & auto-reply backend (Google Apps Script)
 * ---------------------------------------------------------------------------
 * Free, runs on your own Google account. What it does:
 *   • Receives bookings and questions from the website
 *   • Saves them to this Google Sheet ("Bookings" and "Messages" tabs)
 *   • Puts each booking on your Google Calendar
 *   • Instantly emails the customer a branded confirmation (English or Spanish)
 *   • Emails you the details with one-click "Confirm" / "Reschedule" buttons
 *   • Tells the website which times are already taken (no double bookings)
 *   • Sends customers a reminder email the day before their visit
 *   • Saves customer photos to a Google Drive folder
 * Block a whole day by adding an all-day event called "OFF" to your calendar.
 * Setup steps: see SETUP.md (about 10 minutes).
 */

var CONFIG = {
  BUSINESS_NAME: 'J Sanchez Home Improvements LLC',
  OWNER_EMAIL: 'jclsanchez45@gmail.com',
  PHONE: '954-295-7763',
  PHONE_E164: '+19542957763',
  WHATSAPP: '19542957763',
  SITE_URL: '',                    // e.g. 'https://jsanchezhomes.com' (used in emails)
  TIMEZONE: 'America/New_York',
  CALENDAR_ID: 'primary',          // or a specific calendar's ID
  CHECK_CALENDAR_BUSY: true,       // treat your existing calendar events as busy time
  SLOTS: ['08:00', '10:00', '12:00', '14:00', '16:00'],   // must match js/config.js
  SATURDAY_SLOTS: ['08:00', '10:00', '12:00'],
  CLOSED_WEEKDAYS: [0],            // Sunday
  VISIT_MINUTES: 90,
  DAYS_AHEAD: 42,
  MIN_LEAD_HOURS: 16,
  PHOTO_FOLDER_NAME: 'Website booking photos',
  NAVY: '#0b1b3a',
  GOLD: '#c9a24a'
};

var BOOKING_HEADERS = ['Ref', 'Submitted', 'Status', 'Services', 'Date', 'Time', 'Name', 'Phone', 'Email',
  'Contact via', 'Language', 'ZIP', 'Address', 'Property', 'Timeline', 'Details', 'Photos', 'Calendar event', 'Reminder sent', 'Source'];
var MESSAGE_HEADERS = ['Submitted', 'Name', 'Phone', 'Email', 'Language', 'Message', 'Source'];
var STATUS = { NEW: 'New - needs confirmation', CONFIRMED: 'Confirmed', RESCHEDULE: 'Reschedule needed', CANCELLED: 'Cancelled', DONE: 'Completed' };
var FREE_STATUSES = [STATUS.RESCHEDULE, STATUS.CANCELLED];

var SERVICE_NAMES = {
  bathroom: { en: 'Bathroom Remodeling', es: 'Remodelación de baños' },
  kitchen: { en: 'Kitchen Remodeling', es: 'Remodelación de cocinas' },
  flooring: { en: 'Flooring', es: 'Pisos' },
  ceiling: { en: 'Ceiling Work', es: 'Techos y cielo raso' },
  painting: { en: 'Interior Painting', es: 'Pintura interior' },
  plumbing: { en: 'Plumbing', es: 'Plomería' },
  electrical: { en: 'Electrical', es: 'Electricidad' },
  other: { en: 'Other / Repairs', es: 'Otro / Reparaciones' }
};

/* =========================================================================
   One-time setup — run this once from the Apps Script editor
   ========================================================================= */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'Bookings', BOOKING_HEADERS);
  ensureSheet_(ss, 'Messages', MESSAGE_HEADERS);
  secret_();
  photoFolder_();
  installReminderTrigger();
  Logger.log('Setup complete. Now click Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).');
}

function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(9).create();
}

/* =========================================================================
   Web endpoints
   ========================================================================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'availability') return json_(availability_());
    if (p.action === 'confirm' || p.action === 'reschedule' || p.action === 'cancel') return ownerAction_(p);
    return json_({ ok: true, service: CONFIG.BUSINESS_NAME + ' booking API' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (data.website) return json_({ ok: true, ref: data.ref || 'JS-OK' }); // honeypot: silently drop bots
  try {
    if (data.type === 'message') return json_(handleMessage_(data));
    return json_(handleBooking_(data));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

/* =========================================================================
   Bookings
   ========================================================================= */
function handleBooking_(d) {
  var v = validateBooking_(d);
  if (v) return { ok: false, error: v };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var busy = busySlots_();
    if (busy.indexOf(d.date + ' ' + d.time) !== -1) return { ok: false, error: 'slot_taken' };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ensureSheet_(ss, 'Bookings', BOOKING_HEADERS);
    var ref = uniqueRef_(sheet, d.ref);
    var lang = d.lang === 'es' ? 'es' : 'en';
    var services = (d.services || []).map(function (id) { return (SERVICE_NAMES[id] || { en: id }).en; }).join(', ');
    var photos = savePhotos_(ref, d.photos);

    var start = slotStart_(d.date, d.time);
    var end = new Date(start.getTime() + CONFIG.VISIT_MINUTES * 60000);
    var eventId = '';
    try {
      var cal = calendar_();
      var ev = cal.createEvent('Estimate: ' + clip_(d.name, 60) + ' - ' + services, start, end, {
        location: [d.address, d.zip].filter(String).join(', '),
        description: ownerText_(d, ref, services, photos)
      });
      ev.setColor(CalendarApp.EventColor.YELLOW);
      eventId = ev.getId();
    } catch (calErr) { console.error('Calendar error', calErr); }

    sheet.appendRow([
      ref, new Date(), STATUS.NEW, services, d.date, d.time, clip_(d.name, 100), clip_(d.phone, 30), clip_(d.email, 120),
      d.contactMethod || '', lang === 'es' ? 'Spanish' : 'English', clip_(d.zip, 10), clip_(d.address, 200),
      d.propertyType || '', d.timeline || '', clip_(d.details, 2000), photos.join('\n'), eventId, '', clip_(d.page, 200)
    ]);
    CacheService.getScriptCache().remove('availability');

    // Instant auto-reply to the customer
    try {
      MailApp.sendEmail({
        to: d.email, replyTo: CONFIG.OWNER_EMAIL, name: CONFIG.BUSINESS_NAME,
        subject: lang === 'es' ? 'Recibimos su reserva (' + ref + ') - J Sanchez Home Improvements' : 'We got your booking (' + ref + ') - J Sanchez Home Improvements',
        htmlBody: customerEmail_(d, ref, 'received'),
        body: customerText_(d, ref, 'received')
      });
    } catch (mailErr) { console.error('Customer email error', mailErr); }

    // Notify the owner
    MailApp.sendEmail({
      to: CONFIG.OWNER_EMAIL, replyTo: d.email, name: 'Website bookings',
      subject: 'New booking ' + ref + ': ' + services + ' - ' + prettyDate_(d.date, 'en') + ' ' + prettyTime_(d.time, 'en'),
      htmlBody: ownerEmail_(d, ref, services, photos),
      body: ownerText_(d, ref, services, photos)
    });

    return { ok: true, ref: ref };
  } finally {
    lock.releaseLock();
  }
}

function validateBooking_(d) {
  if (!d || !d.name || String(d.name).trim().length < 2) return 'invalid_name';
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email).trim())) return 'invalid_email';
  if (!d.phone || String(d.phone).replace(/\D/g, '').length < 10) return 'invalid_phone';
  if (!d.services || !d.services.length) return 'invalid_services';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return 'invalid_date';
  if (slotsFor_(d.date).indexOf(d.time) === -1) return 'invalid_time';
  if (CONFIG.CLOSED_WEEKDAYS.indexOf(slotStart_(d.date, d.time).getDay()) !== -1) return 'closed';
  var earliest = new Date(Date.now() + CONFIG.MIN_LEAD_HOURS * 3600000 - 30 * 60000);
  if (slotStart_(d.date, d.time) < earliest) return 'too_soon';
  return '';
}

/* =========================================================================
   Messages (chat / quick questions)
   ========================================================================= */
function handleMessage_(d) {
  if (!d.name || String(d.phone || '').replace(/\D/g, '').length < 10) return { ok: false, error: 'invalid' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'Messages', MESSAGE_HEADERS).appendRow([
    new Date(), clip_(d.name, 100), clip_(d.phone, 30), clip_(d.email, 120), d.lang === 'es' ? 'Spanish' : 'English', clip_(d.message, 1000), clip_(d.page, 200)
  ]);
  var lang = d.lang === 'es' ? 'es' : 'en';
  if (d.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) {
    try {
      MailApp.sendEmail({
        to: d.email, replyTo: CONFIG.OWNER_EMAIL, name: CONFIG.BUSINESS_NAME,
        subject: lang === 'es' ? 'Recibimos su mensaje - J Sanchez Home Improvements' : 'We got your message - J Sanchez Home Improvements',
        htmlBody: wrapEmail_(lang,
          '<h1 style="margin:0 0 12px;font-size:22px;color:' + CONFIG.NAVY + '">' + (lang === 'es' ? '¡Gracias, ' : 'Thanks, ') + esc_(first_(d.name)) + '!</h1>' +
          '<p>' + (lang === 'es' ? 'Recibimos su mensaje y le responderemos pronto.' : 'We received your message and will get back to you soon.') + '</p>' +
          '<blockquote style="margin:16px 0;padding:12px 16px;background:#f8f5ef;border-left:4px solid ' + CONFIG.GOLD + ';">' + esc_(d.message) + '</blockquote>' +
          '<p>' + (lang === 'es' ? '¿Es urgente? Llame o escriba al ' : 'Urgent? Call or text ') + '<a href="tel:' + CONFIG.PHONE_E164 + '">' + CONFIG.PHONE + '</a>.</p>'),
        body: (lang === 'es' ? 'Gracias. Recibimos su mensaje y le responderemos pronto. ' : 'Thanks! We received your message and will get back to you soon. ') + CONFIG.PHONE
      });
    } catch (err) { console.error(err); }
  }
  MailApp.sendEmail({
    to: CONFIG.OWNER_EMAIL, replyTo: d.email || CONFIG.OWNER_EMAIL, name: 'Website messages',
    subject: 'Website question from ' + clip_(d.name, 60),
    body: 'Name: ' + d.name + '\nPhone: ' + d.phone + '\nEmail: ' + (d.email || '-') + '\nLanguage: ' + lang + '\n\n' + d.message
  });
  return { ok: true };
}

/* =========================================================================
   Availability
   ========================================================================= */
function availability_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('availability');
  if (hit) return JSON.parse(hit);
  var res = { ok: true, busy: busySlots_(), closedDates: closedDates_() };
  cache.put('availability', JSON.stringify(res), 300);
  return res;
}

function busySlots_() {
  var busy = {};
  var todayStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bookings');
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues().forEach(function (r) {
      var status = r[2], date = dateCell_(r[4]), time = timeCell_(r[5]);
      if (date >= todayStr && FREE_STATUSES.indexOf(status) === -1) busy[date + ' ' + time] = 1;
    });
  }
  if (CONFIG.CHECK_CALENDAR_BUSY) {
    try {
      var from = new Date(), to = new Date(Date.now() + (CONFIG.DAYS_AHEAD + 1) * 86400000);
      calendar_().getEvents(from, to).forEach(function (ev) {
        if (ev.isAllDayEvent()) return;
        var s = ev.getStartTime().getTime(), en = ev.getEndTime().getTime();
        for (var d = new Date(s - 86400000); d.getTime() <= en; d = new Date(d.getTime() + 86400000)) {
          var ds = Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
          slotsFor_(ds).forEach(function (tm) {
            var a = slotStart_(ds, tm).getTime(), b = a + CONFIG.VISIT_MINUTES * 60000;
            if (a < en && b > s) busy[ds + ' ' + tm] = 1;
          });
        }
      });
    } catch (err) { console.error('Calendar read error', err); }
  }
  return Object.keys(busy);
}

function closedDates_() {
  var out = {};
  try {
    var from = new Date(Date.now() - 86400000), to = new Date(Date.now() + (CONFIG.DAYS_AHEAD + 1) * 86400000);
    calendar_().getEvents(from, to).forEach(function (ev) {
      if (!ev.isAllDayEvent()) return;
      if (!/\b(off|closed|blocked|vacation|holiday|cerrado|libre|vacaciones)\b/i.test(ev.getTitle())) return;
      for (var d = new Date(ev.getAllDayStartDate().getTime()); d < ev.getAllDayEndDate(); d = new Date(d.getTime() + 86400000)) {
        out[Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd')] = 1;
      }
    });
  } catch (err) { console.error(err); }
  return Object.keys(out);
}

/* =========================================================================
   Owner one-click actions (links in the notification email)
   ========================================================================= */
function ownerAction_(p) {
  if (!p.ref || !p.sig || p.sig !== sign_(p.ref + ':' + p.action)) return page_('Link not valid', 'This link is invalid or has expired.');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bookings');
  var row = findRow_(sheet, p.ref);
  if (!row) return page_('Not found', 'Booking ' + esc_(p.ref) + ' was not found.');
  var values = sheet.getRange(row, 1, 1, BOOKING_HEADERS.length).getValues()[0];
  var rec = rowToBooking_(values);
  var newStatus = p.action === 'confirm' ? STATUS.CONFIRMED : p.action === 'cancel' ? STATUS.CANCELLED : STATUS.RESCHEDULE;
  if (values[2] === newStatus) return page_('Already done', 'Booking ' + esc_(p.ref) + ' is already marked "' + esc_(newStatus) + '".');
  sheet.getRange(row, 3).setValue(newStatus);
  CacheService.getScriptCache().remove('availability');

  try {
    if (rec.eventId) {
      var ev = calendar_().getEventById(rec.eventId);
      if (ev) {
        if (p.action === 'confirm') { ev.setColor(CalendarApp.EventColor.GREEN); ev.setTitle(ev.getTitle().replace(/^Estimate:/, 'CONFIRMED Estimate:')); }
        else ev.deleteEvent();
      }
    }
  } catch (err) { console.error(err); }

  var kind = p.action === 'confirm' ? 'confirmed' : 'reschedule';
  MailApp.sendEmail({
    to: rec.email, replyTo: CONFIG.OWNER_EMAIL, name: CONFIG.BUSINESS_NAME,
    subject: kind === 'confirmed'
      ? (rec.lang === 'es' ? 'Visita confirmada (' + rec.ref + ') - J Sanchez Home Improvements' : 'Your visit is confirmed (' + rec.ref + ') - J Sanchez Home Improvements')
      : (rec.lang === 'es' ? 'Necesitamos cambiar el horario (' + rec.ref + ')' : 'Let\'s find a better time (' + rec.ref + ')'),
    htmlBody: customerEmail_(rec, rec.ref, kind),
    body: customerText_(rec, rec.ref, kind)
  });
  return page_(newStatus, 'Booking ' + esc_(rec.ref) + ' for ' + esc_(rec.name) + ' is now marked "' + esc_(newStatus) + '". The customer has been emailed.');
}

/* =========================================================================
   Daily reminders (runs every morning via the trigger made in setup())
   ========================================================================= */
function sendReminders() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bookings');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var tomorrow = Utilities.formatDate(new Date(Date.now() + 86400000), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, BOOKING_HEADERS.length).getValues();
  var sent = 0;
  values.forEach(function (r, i) {
    var rec = rowToBooking_(r);
    if (rec.date !== tomorrow || r[18] || (r[2] !== STATUS.CONFIRMED && r[2] !== STATUS.NEW)) return;
    try {
      MailApp.sendEmail({
        to: rec.email, replyTo: CONFIG.OWNER_EMAIL, name: CONFIG.BUSINESS_NAME,
        subject: rec.lang === 'es' ? 'Recordatorio: su visita es mañana (' + rec.ref + ')' : 'Reminder: your visit is tomorrow (' + rec.ref + ')',
        htmlBody: customerEmail_(rec, rec.ref, 'reminder'),
        body: customerText_(rec, rec.ref, 'reminder')
      });
      sheet.getRange(i + 2, 19).setValue(new Date());
      sent++;
    } catch (err) { console.error(err); }
  });
  return sent;
}

/* =========================================================================
   Emails
   ========================================================================= */
function customerEmail_(d, ref, kind) {
  var es = d.lang === 'es';
  var name = esc_(first_(d.name));
  var services = (d.services || []).map(function (id) { return (SERVICE_NAMES[id] || { en: id, es: id })[es ? 'es' : 'en']; }).join(', ') || esc_(d.servicesText || '');
  var when = prettyDate_(d.date, es ? 'es' : 'en') + ' · ' + prettyTime_(d.time, es ? 'es' : 'en') + (es ? ' (hora del Este)' : ' (Eastern Time)');
  var heads = {
    received: es ? '¡Gracias, ' + name + '! Recibimos su reserva.' : 'Thanks, ' + name + '! We got your booking.',
    confirmed: es ? '¡Su visita está confirmada, ' + name + '!' : 'You\'re confirmed, ' + name + '!',
    reschedule: es ? name + ', necesitamos encontrar otro horario' : name + ', let\'s find a better time',
    reminder: es ? 'Recordatorio: lo visitamos mañana' : 'Reminder: we\'ll see you tomorrow'
  };
  var intros = {
    received: es ? 'Revisaremos su solicitud y lo contactaremos para confirmar la visita (o sugerirle otro horario si es necesario).' : 'We\'ll review your request and reach out to confirm your visit (or suggest another time if needed).',
    confirmed: es ? 'Todo listo. Llegaremos a la hora indicada para revisar su proyecto y darle un estimado por escrito.' : 'You\'re all set. We\'ll arrive at the time below to walk your project and give you a written estimate.',
    reschedule: es ? 'Lamentablemente no podemos llegar a la hora solicitada. Lo contactaremos pronto para acordar un mejor horario, o puede reservar otro horario en nuestro sitio.' : 'Unfortunately we can\'t make the requested time. We\'ll contact you shortly to set up a better time — or you can pick a new time on our website.',
    reminder: es ? 'Le recordamos su visita de estimado. Si necesita cambiar algo, llámenos o escríbanos.' : 'Just a friendly reminder about your estimate visit. If anything changes, call or text us.'
  };
  var rows = [
    [es ? 'Confirmación n.º' : 'Confirmation #', '<strong>' + esc_(ref) + '</strong>'],
    [es ? 'Servicios' : 'Services', services],
    [es ? 'Fecha y hora' : 'When', when],
    [es ? 'Ubicación' : 'Where', esc_([d.address, d.zip].filter(String).join(', '))]
  ];
  var table = '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:18px 0;border-collapse:collapse;background:#f8f5ef;border-radius:12px">' +
    rows.map(function (r) {
      return '<tr><td style="padding:10px 16px;font-weight:700;color:' + CONFIG.NAVY + ';white-space:nowrap;vertical-align:top">' + r[0] + '</td><td style="padding:10px 16px;color:#0e1830">' + r[1] + '</td></tr>';
    }).join('') + '</table>';
  var btn = function (href, label, gold) {
    return '<a href="' + href + '" style="display:inline-block;margin:4px 6px 4px 0;padding:12px 20px;border-radius:999px;font-weight:700;text-decoration:none;' +
      (gold ? 'background:' + CONFIG.GOLD + ';color:' + CONFIG.NAVY : 'background:' + CONFIG.NAVY + ';color:#ffffff') + '">' + label + '</a>';
  };
  var actions = btn('tel:' + CONFIG.PHONE_E164, (es ? 'Llamar ' : 'Call ') + CONFIG.PHONE, true) +
    btn('sms:' + CONFIG.PHONE_E164, es ? 'Enviar mensaje' : 'Send a text') +
    btn('https://wa.me/' + CONFIG.WHATSAPP, 'WhatsApp');
  var extra = kind === 'received'
    ? '<p style="margin:0 0 8px">' + (es ? '¿Tiene fotos del proyecto? Envíelas por mensaje: nos ayudan a prepararnos.' : 'Have photos of the project? Text them to us — it helps us prepare.') + '</p>'
    : '';
  var rebook = kind === 'reschedule' && CONFIG.SITE_URL ? '<p>' + btn(CONFIG.SITE_URL + '#book', es ? 'Elegir otro horario' : 'Pick a new time', true) + '</p>' : '';
  return wrapEmail_(d.lang,
    '<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:' + CONFIG.NAVY + '">' + heads[kind] + '</h1>' +
    '<p style="margin:0">' + intros[kind] + '</p>' + table + extra + rebook +
    '<p style="margin:16px 0 4px;font-weight:700;color:' + CONFIG.NAVY + '">' + (es ? '¿Preguntas o cambios?' : 'Questions or changes?') + '</p>' + actions);
}

function customerText_(d, ref, kind) {
  var es = d.lang === 'es';
  var services = (d.services || []).map(function (id) { return (SERVICE_NAMES[id] || { en: id, es: id })[es ? 'es' : 'en']; }).join(', ');
  var lines = {
    received: es ? 'Gracias. Recibimos su reserva y lo contactaremos para confirmarla.' : 'Thanks! We received your booking and will reach out to confirm it.',
    confirmed: es ? 'Su visita está confirmada.' : 'Your visit is confirmed.',
    reschedule: es ? 'Necesitamos cambiar el horario; lo contactaremos pronto.' : 'We need to find a better time; we will contact you shortly.',
    reminder: es ? 'Recordatorio: su visita es mañana.' : 'Reminder: your visit is tomorrow.'
  };
  return lines[kind] + '\n\n' + (es ? 'Confirmación: ' : 'Confirmation: ') + ref + '\n' + (es ? 'Servicios: ' : 'Services: ') + services +
    '\n' + (es ? 'Fecha: ' : 'When: ') + prettyDate_(d.date, es ? 'es' : 'en') + ' ' + prettyTime_(d.time, es ? 'es' : 'en') +
    '\n\n' + CONFIG.BUSINESS_NAME + ' - ' + CONFIG.PHONE;
}

function ownerEmail_(d, ref, services, photos) {
  var base = ScriptApp.getService().getUrl();
  var link = function (action) { return base + '?action=' + action + '&ref=' + encodeURIComponent(ref) + '&sig=' + sign_(ref + ':' + action); };
  var btn = function (href, label, bg, color) {
    return '<a href="' + href + '" style="display:inline-block;margin:4px 8px 4px 0;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;background:' + bg + ';color:' + color + '">' + label + '</a>';
  };
  var digits = String(d.phone).replace(/\D/g, '');
  var rows = [
    ['Ref', ref], ['When', prettyDate_(d.date, 'en') + ' at ' + prettyTime_(d.time, 'en')], ['Services', services],
    ['Name', d.name], ['Phone', '<a href="tel:+1' + digits.slice(-10) + '">' + esc_(d.phone) + '</a>'], ['Email', '<a href="mailto:' + esc_(d.email) + '">' + esc_(d.email) + '</a>'],
    ['Prefers', esc_(d.contactMethod || '-') + ' · ' + (d.lang === 'es' ? 'Spanish' : 'English')],
    ['Location', esc_([d.address, d.zip].filter(String).join(', '))], ['Property', esc_(d.propertyType || '-')], ['Start', esc_(d.timeline || '-')],
    ['Details', esc_(d.details || '').replace(/\n/g, '<br>')],
    ['Photos', photos.length ? photos.map(function (u, i) { return '<a href="' + u + '">Photo ' + (i + 1) + '</a>'; }).join(' · ') : '-']
  ];
  return wrapEmail_('en',
    '<h1 style="margin:0 0 6px;font-size:22px;color:' + CONFIG.NAVY + '">New booking request</h1>' +
    '<p style="margin:0 0 12px;color:#5a6478">The customer already received an automatic confirmation email.</p>' +
    btn(link('confirm'), 'Confirm visit', '#1f8a5b', '#ffffff') + btn(link('reschedule'), 'Need to reschedule', CONFIG.GOLD, CONFIG.NAVY) +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-collapse:collapse;background:#f8f5ef;border-radius:12px">' +
    rows.map(function (r) {
      return '<tr><td style="padding:9px 14px;font-weight:700;color:' + CONFIG.NAVY + ';white-space:nowrap;vertical-align:top">' + r[0] + '</td><td style="padding:9px 14px">' + (r[0] === 'Ref' || r[0] === 'When' || r[0] === 'Services' || r[0] === 'Name' ? esc_(r[1]) : r[1]) + '</td></tr>';
    }).join('') + '</table>' +
    btn('tel:+1' + digits.slice(-10), 'Call customer', CONFIG.NAVY, '#ffffff') +
    btn('sms:+1' + digits.slice(-10), 'Text customer', CONFIG.NAVY, '#ffffff') +
    btn('https://wa.me/1' + digits.slice(-10), 'WhatsApp', CONFIG.NAVY, '#ffffff'));
}

function ownerText_(d, ref, services, photos) {
  return 'Ref: ' + ref + '\nWhen: ' + prettyDate_(d.date, 'en') + ' ' + prettyTime_(d.time, 'en') + '\nServices: ' + services +
    '\nName: ' + d.name + '\nPhone: ' + d.phone + '\nEmail: ' + d.email + '\nPrefers: ' + (d.contactMethod || '-') +
    '\nLanguage: ' + (d.lang === 'es' ? 'Spanish' : 'English') + '\nLocation: ' + [d.address, d.zip].filter(String).join(', ') +
    '\nProperty: ' + (d.propertyType || '-') + '\nStart: ' + (d.timeline || '-') + '\n\nDetails:\n' + (d.details || '') +
    (photos && photos.length ? '\n\nPhotos:\n' + photos.join('\n') : '');
}

function wrapEmail_(lang, inner) {
  var es = lang === 'es';
  return '<div style="background:#f1efe9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0e1830">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">' +
    '<div style="background:' + CONFIG.NAVY + ';padding:20px 24px;border-bottom:4px solid ' + CONFIG.GOLD + '">' +
    '<div style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:.5px">J SANCHEZ</div>' +
    '<div style="color:' + CONFIG.GOLD + ';font-size:11px;font-weight:700;letter-spacing:2px">HOME IMPROVEMENTS LLC</div></div>' +
    '<div style="padding:24px">' + inner + '</div>' +
    '<div style="padding:16px 24px;background:#f8f5ef;color:#5a6478;font-size:12px">' + CONFIG.BUSINESS_NAME + ' · ' + CONFIG.PHONE + ' · ' + CONFIG.OWNER_EMAIL +
    '<br><em>' + (es ? 'Su hogar, nuestro compromiso' : 'Your Home, Our Commitment') + '</em></div></div></div>';
}

function page_(title, msg) {
  return HtmlService.createHtmlOutput('<div style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:28px;border-radius:16px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.1)">' +
    '<div style="color:' + CONFIG.GOLD + ';font-weight:700;letter-spacing:2px;font-size:12px">J SANCHEZ HOME IMPROVEMENTS</div>' +
    '<h1 style="color:' + CONFIG.NAVY + '">' + esc_(title) + '</h1><p>' + msg + '</p></div>').setTitle(title);
}

/* =========================================================================
   Helpers
   ========================================================================= */
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function calendar_() { return CONFIG.CALENDAR_ID === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.CALENDAR_ID); }
function slotsFor_(ds) { var day = new Date(ds + 'T12:00:00').getDay(); return day === 6 && CONFIG.SATURDAY_SLOTS ? CONFIG.SATURDAY_SLOTS : CONFIG.SLOTS; }
// Dates are built in the script's time zone (set to America/New_York in appsscript.json)
function slotStart_(ds, tm) { var p = ds.split('-'), h = tm.split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +h[0], +h[1], 0, 0); }
function dateCell_(v) { return v instanceof Date ? Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd') : String(v); }
function timeCell_(v) { return v instanceof Date ? Utilities.formatDate(v, CONFIG.TIMEZONE, 'HH:mm') : String(v); }
function clip_(s, n) { s = s == null ? '' : String(s); s = s.length > n ? s.slice(0, n) : s; return /^[=+\-@]/.test(s) ? "'" + s : s; } // also blocks spreadsheet formula injection
function first_(name) { return String(name || '').trim().split(/\s+/)[0]; }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

var MONTHS = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] };
var DAYS = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] };
function prettyDate_(ds, lang) {
  var p = String(ds).split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
  return lang === 'es'
    ? DAYS.es[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS.es[d.getMonth()] + ' de ' + d.getFullYear()
    : DAYS.en[d.getDay()] + ', ' + MONTHS.en[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}
function prettyTime_(tm, lang) {
  var h = +String(tm).split(':')[0], m = String(tm).split(':')[1] || '00';
  var ap = h < 12 ? (lang === 'es' ? 'a. m.' : 'AM') : (lang === 'es' ? 'p. m.' : 'PM');
  return ((h + 11) % 12 + 1) + ':' + m + ' ' + ap;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground(CONFIG.NAVY).setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function uniqueRef_(sheet, ref) {
  ref = /^JS-[A-Z0-9]{6}$/.test(ref || '') ? ref : 'JS-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  while (findRow_(sheet, ref)) ref = 'JS-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  return ref;
}
function findRow_(sheet, ref) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var refs = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) if (refs[i][0] === ref) return i + 2;
  return 0;
}
function rowToBooking_(r) {
  var names = String(r[3]).split(', ');
  var ids = names.map(function (n) { for (var k in SERVICE_NAMES) if (SERVICE_NAMES[k].en === n) return k; return n; });
  return { ref: r[0], status: r[2], services: ids, date: dateCell_(r[4]), time: timeCell_(r[5]), name: r[6], phone: r[7], email: r[8],
    contactMethod: r[9], lang: r[10] === 'Spanish' ? 'es' : 'en', zip: String(r[11]), address: r[12], eventId: r[17] };
}
function secret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SIGNING_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SIGNING_SECRET', s); }
  return s;
}
function sign_(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value, secret_())).replace(/=+$/, '').slice(0, 32);
}
function photoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate */ } }
  var f = DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', f.getId());
  return f;
}
function savePhotos_(ref, photos) {
  if (!photos || !photos.length) return [];
  var urls = [];
  try {
    var folder = photoFolder_();
    photos.slice(0, 6).forEach(function (p, i) {
      if (!p || !p.data || !/^image\//.test(p.type || '')) return;
      var bytes = Utilities.base64Decode(p.data);
      if (bytes.length > 8 * 1024 * 1024) return;
      var file = folder.createFile(Utilities.newBlob(bytes, p.type, ref + '-' + (i + 1) + '.jpg'));
      urls.push(file.getUrl());
    });
  } catch (err) { console.error('Photo save error', err); }
  return urls;
}
