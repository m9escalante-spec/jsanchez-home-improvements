// Runs backend/apps-script/Code.gs against in-memory fakes of the Google services.
// Usage:  TZ=America/New_York node tests/apps-script.test.mjs
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const code = fs.readFileSync(new URL("../backend/apps-script/Code.gs", import.meta.url), "utf8");

function makeEnv() {
  const sent = [], sheets = {}, events = [], props = {}, cache = {}, files = [];
  let evSeq = 0;
  const makeSheet = (name) => {
    const rows = [];
    const sh = {
      name, rows,
      appendRow: (r) => rows.push(r.slice()),
      getLastRow: () => rows.length,
      setFrozenRows() {},
      getRange(row, col, nr = 1, nc = 1) {
        const rng = {
          getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[row - 1 + i] || [])[col - 1 + j] ?? "")),
          setValue: (v) => { rows[row - 1][col - 1] = v; return rng; },
          setFontWeight: () => rng, setBackground: () => rng, setFontColor: () => rng
        };
        return rng;
      }
    };
    return sh;
  };
  const ss = { getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = makeSheet(n)) };
  const makeEvent = (title, start, end, opts = {}, allDay = false) => {
    const ev = { id: "ev" + ++evSeq, title, start, end, opts, color: null, deleted: false, allDay,
      getId: () => ev.id, setColor: (c) => { ev.color = c; }, getTitle: () => ev.title, setTitle: (t) => { ev.title = t; },
      deleteEvent: () => { ev.deleted = true; }, isAllDayEvent: () => ev.allDay,
      getStartTime: () => ev.start, getEndTime: () => ev.end, getAllDayStartDate: () => ev.start, getAllDayEndDate: () => ev.end };
    events.push(ev); return ev;
  };
  const cal = {
    createEvent: (t, s, e, o) => makeEvent(t, s, e, o),
    getEvents: (from, to) => events.filter((ev) => !ev.deleted && ev.start < to && ev.end > from),
    getEventById: (id) => events.find((e) => e.id === id) || null
  };
  const fmt = (date, tz, pattern) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
    if (pattern === "yyyy-MM-dd") return `${p.year}-${p.month}-${p.day}`;
    if (pattern === "HH:mm") return `${p.hour}:${p.minute}`;
    throw new Error("unsupported pattern " + pattern);
  };
  const ctx = {
    console: { log() {}, error() {} },
    Logger: { log() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    CalendarApp: { getDefaultCalendar: () => cal, getCalendarById: () => cal, EventColor: { YELLOW: "5", GREEN: "10" } },
    MailApp: { sendEmail: (m) => sent.push(m) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }) },
    HtmlService: { createHtmlOutput: (h) => ({ html: h, setTitle() { return this; } }) },
    ScriptApp: {
      getService: () => ({ getUrl: () => "https://script.google.com/macros/s/TEST/exec" }),
      getProjectTriggers: () => [], deleteTrigger() {},
      newTrigger: () => { const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => ({}) }; return b; }
    },
    DriveApp: {
      createFolder: (name) => ({ getId: () => "folder1", createFile: (blob) => { files.push(blob); return { getUrl: () => "https://drive.google.com/file/" + files.length }; } }),
      getFolderById: () => ctx.DriveApp.createFolder("x")
    },
    Utilities: {
      formatDate: fmt,
      getUuid: () => crypto.randomUUID(),
      base64Decode: (s) => Array.from(Buffer.from(s, "base64")),
      newBlob: (bytes, type, name) => ({ bytes, type, name }),
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac("sha256", k).update(v).digest()),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_")
    },
    Date, JSON, Math, Object, String, Array, RegExp, Number, Error
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, sent, sheets, events, props, files, makeEvent };
}

// ---- helpers ----
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function futureWeekday(daysAhead, wantSaturday = false) {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || (!wantSaturday && d.getDay() === 6)) d.setDate(d.getDate() + 1);
  return ymd(d);
}
const post = (env, data) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(data) } }).content);
const get = (env, params) => env.ctx.doGet({ parameter: params });
const booking = (over = {}) => ({
  type: "booking", ref: "JS-ABC234", lang: "en", services: ["bathroom", "flooring"], date: futureWeekday(4), time: "10:00",
  details: "Replace tub with walk-in shower", zip: "33024", address: "123 Main St", propertyType: "House", timeline: "ASAP",
  name: "Maria Lopez", phone: "(954) 555-0123", email: "maria@example.com", contactMethod: "Text", photos: [], website: "", page: "https://example.test/", ...over
});

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log("  ✓ " + name); };

console.log("Apps Script backend");
const env = makeEnv();

test("setup() creates Bookings and Messages sheets with headers", () => {
  env.ctx.setup();
  assert.equal(env.sheets.Bookings.rows[0][0], "Ref");
  assert.equal(env.sheets.Messages.rows[0][1], "Name");
});

test("availability marks slots overlapping existing calendar events as busy", () => {
  const ds = futureWeekday(6);
  const [y, m, d] = ds.split("-").map(Number);
  env.makeEvent("Dentist", new Date(y, m - 1, d, 12, 30), new Date(y, m - 1, d, 13, 30));
  const res = JSON.parse(get(env, { action: "availability" }).content);
  assert.equal(res.ok, true);
  assert.ok(res.busy.includes(`${ds} 12:00`), "12:00 visit overlaps 12:30 event");
  assert.ok(!res.busy.includes(`${ds} 14:00`));
});

test("all-day 'OFF' calendar event closes the whole day", () => {
  const ds = futureWeekday(9);
  const [y, m, d] = ds.split("-").map(Number);
  env.makeEvent("OFF - family", new Date(y, m - 1, d), new Date(y, m - 1, d + 1), {}, true);
  env.ctx.CacheService.getScriptCache().remove("availability");
  const res = JSON.parse(get(env, { action: "availability" }).content);
  assert.ok(res.closedDates.includes(ds));
});

let ownerMail, ref;
test("valid booking: saved, calendar event, auto-reply + owner email", () => {
  const before = env.sent.length;
  const res = post(env, booking());
  assert.equal(res.ok, true, JSON.stringify(res));
  ref = res.ref;
  assert.equal(ref, "JS-ABC234");
  const row = env.sheets.Bookings.rows.at(-1);
  assert.equal(row[0], ref); assert.equal(row[2], "New - needs confirmation"); assert.equal(row[3], "Bathroom Remodeling, Flooring");
  const ev = env.events.find((e) => e.title.startsWith("Estimate: Maria Lopez"));
  assert.ok(ev, "calendar event created"); assert.equal(ev.start.getHours(), 10);
  assert.equal(env.sent.length - before, 2);
  const cust = env.sent[before];
  assert.equal(cust.to, "maria@example.com"); assert.match(cust.subject, /JS-ABC234/); assert.match(cust.htmlBody, /We got your booking/);
  ownerMail = env.sent[before + 1];
  assert.equal(ownerMail.to, "jclsanchez45@gmail.com"); assert.match(ownerMail.htmlBody, /action=confirm&amp;ref=|action=confirm&ref=/);
});

test("same slot again is rejected as slot_taken (no double booking)", () => {
  const res = post(env, booking({ ref: "JS-ZZZ999", email: "other@example.com" }));
  assert.deepEqual(res, { ok: false, error: "slot_taken" });
});

test("booked slot shows up in availability", () => {
  const res = JSON.parse(get(env, { action: "availability" }).content);
  assert.ok(res.busy.includes(`${booking().date} 10:00`));
});

test("honeypot submissions are dropped silently", () => {
  const rows = env.sheets.Bookings.rows.length, mails = env.sent.length;
  const res = post(env, booking({ time: "14:00", website: "spam.example" }));
  assert.equal(res.ok, true);
  assert.equal(env.sheets.Bookings.rows.length, rows); assert.equal(env.sent.length, mails);
});

test("validation: bad email, Sunday, too soon, unknown time", () => {
  assert.equal(post(env, booking({ email: "nope" })).error, "invalid_email");
  const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7 || 7));
  assert.equal(post(env, booking({ date: ymd(sun), time: "10:00" })).error, "closed");
  assert.equal(post(env, booking({ date: ymd(new Date()), time: "08:00" })).error, "too_soon");
  assert.equal(post(env, booking({ time: "09:15" })).error, "invalid_time");
});

test("confirm link from owner email: status, calendar color, customer email", () => {
  const href = ownerMail.htmlBody.match(/href="([^"]*action=confirm[^"]*)"/)[1];
  const params = Object.fromEntries(new URL(href).searchParams);
  const before = env.sent.length;
  const page = get(env, params);
  assert.match(page.html, /Confirmed/);
  assert.equal(env.sheets.Bookings.rows.find((r) => r[0] === ref)[2], "Confirmed");
  const ev = env.events.find((e) => e.title.includes("Maria Lopez"));
  assert.equal(ev.color, "10"); assert.match(ev.title, /^CONFIRMED/);
  assert.equal(env.sent.length - before, 1); assert.match(env.sent.at(-1).subject, /confirmed/i);
});

test("tampered confirm link is refused", () => {
  const page = get(env, { action: "cancel", ref, sig: "forged" });
  assert.match(page.html, /Link not valid/);
  assert.equal(env.sheets.Bookings.rows.find((r) => r[0] === ref)[2], "Confirmed");
});

test("Spanish booking gets a Spanish auto-reply; photos saved to Drive", () => {
  const before = env.sent.length;
  const res = post(env, booking({ ref: "JS-ESP234", lang: "es", time: "14:00", email: "ana@example.com", name: "Ana Pérez",
    photos: [{ name: "a.jpg", type: "image/jpeg", data: Buffer.from("fakejpeg").toString("base64") }] }));
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.match(env.sent[before].subject, /Recibimos su reserva/);
  assert.match(env.sent[before].htmlBody, /Gracias, Ana/);
  assert.match(env.sheets.Bookings.rows.at(-1)[16], /drive\.google\.com/);
});

test("spreadsheet formula injection is neutralized", () => {
  post(env, booking({ ref: "JS-INJ234", time: "16:00", name: "=HYPERLINK(\"http://evil\")", email: "x@example.com" }));
  assert.equal(env.sheets.Bookings.rows.at(-1)[6].charAt(0), "'");
});

test("chat messages are logged, auto-replied, and forwarded", () => {
  const before = env.sent.length;
  const res = post(env, { type: "message", lang: "en", name: "Tom", phone: "9545550000", email: "tom@example.com", message: "Do you do decks?", website: "" });
  assert.equal(res.ok, true);
  assert.equal(env.sheets.Messages.rows.at(-1)[5], "Do you do decks?");
  assert.equal(env.sent.length - before, 2);
});

test("reminder emails go out once for tomorrow's visits", () => {
  const t = new Date(); t.setDate(t.getDate() + 1);
  const sh = env.sheets.Bookings;
  sh.appendRow(["JS-TMR234", new Date(), "Confirmed", "Flooring", ymd(t), "10:00", "Leo", "9545551111", "leo@example.com", "Call", "English", "33024", "", "House", "ASAP", "x", "", "", "", ""]);
  assert.equal(env.ctx.sendReminders(), 1);
  assert.match(env.sent.at(-1).subject, /Reminder/);
  assert.equal(env.ctx.sendReminders(), 0);
});

console.log(`\n${passed} backend tests passed`);
