// End-to-end check of the website in a real browser (Playwright + Chromium).
// Usage:  python3 -m http.server 8765 &   then   BASE=http://localhost:8765 node tests/site.test.js
// Network calls to FormSubmit / Apps Script are intercepted, so nothing is really sent.
const { chromium, devices } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE || "http://localhost:8765";
const SHOTS = process.env.SHOTS || "";
const GAS = "https://script.google.com/macros/s/TEST/exec";
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log("  ✓ " + name); }

function watch(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Booking error/.test(m.text())) errors.push("console: " + m.text()); });
  return errors;
}

async function pickFirstSlot(page) {
  await page.locator(".cal-day:not([disabled])").first().click();
  await page.locator(".slot:not([disabled])").first().click();
}

(async () => {
  const browser = await chromium.launch();
  console.log("Website (" + BASE + ")");

  // ---------- Desktop, FormSubmit fallback ----------
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "en-US" });
  const page = await ctx.newPage();
  const errors = watch(page);
  const sentForms = [];
  await page.route("https://formsubmit.co/**", async (route) => {
    sentForms.push({ url: route.request().url(), body: JSON.parse(route.request().postData() || "{}") });
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"success":"true","message":"The form was submitted successfully."}' });
  });
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });

  await test("page loads with no script errors and the brand content", async () => {
    await assert.doesNotReject(page.waitForSelector("text=our commitment."));
    assert.equal(await page.locator(".svc-card").count(), 8);
    assert.deepEqual(errors, []);
  });

  await test("hero shows the next open appointment", async () => {
    const txt = await page.locator("[data-next-slot]").textContent();
    assert.match(txt, /\d{1,2}:\d{2}/);
  });

  await test("gallery shows 'coming soon' tiles while no photos are added", async () => {
    assert.equal(await page.locator(".g-placeholder").count(), 6);
    assert.equal(await page.locator("[data-gallery-empty]").isVisible(), true);
  });

  await test("'Book this service' preselects the service and jumps to date & time", async () => {
    await page.locator('[data-book-service="bathroom"]').first().click();
    await page.waitForSelector('.bstep[data-step="2"].is-active');
    const checked = await page.locator('input[name="services"]:checked').evaluateAll((els) => els.map((e) => e.value));
    assert.deepEqual(checked, ["bathroom"]);
    assert.ok(await page.locator(".cal-day:disabled").count() > 0, "past days / Sundays disabled");
  });

  await test("validation blocks empty steps", async () => {
    await page.click("[data-next]");
    assert.equal(await page.locator('[data-error-for="slot"]').isVisible(), true);
    await pickFirstSlot(page);
    await page.click("[data-next]");
    await page.waitForSelector('.bstep[data-step="3"].is-active');
    await page.click("[data-next]");
    assert.equal(await page.locator('[data-error-for="details"]').isVisible(), true);
    assert.equal(await page.locator('[data-error-for="zip"]').isVisible(), true);
  });

  await test("full booking sends the request + customer auto-reply and shows confirmation", async () => {
    await page.fill('textarea[name="details"]', "Replace tub with a walk-in shower and new vanity.");
    await page.fill('input[name="zip"]', "33024");
    await page.click("[data-next]");
    await page.waitForSelector('.bstep[data-step="4"].is-active');
    await page.fill('input[name="name"]', "Maria Lopez");
    await page.fill('input[name="phone"]', "9545550123");
    await page.fill('input[name="email"]', "maria@example.com");
    assert.match(await page.locator("[data-summary]").textContent(), /Bathroom Remodeling/);
    await page.click("[data-submit]");
    await page.waitForSelector("[data-booking-success]:not([hidden])");
    const ref = await page.locator("[data-ok-ref]").textContent();
    assert.match(ref, /^JS-[A-Z0-9]{6}$/);
    assert.equal(sentForms.length, 1);
    const b = sentForms[0].body;
    assert.match(sentForms[0].url, /formsubmit\.co\/ajax\/jclsanchez45%40gmail\.com/);
    assert.equal(b.email, "maria@example.com");
    assert.equal(b.Services, "Bathroom Remodeling");
    assert.match(b._autoresponse, /Hi Maria/);
    assert.match(b._autoresponse, new RegExp(ref));
    assert.match(await page.locator("[data-ok-gcal]").getAttribute("href"), /calendar\.google\.com.*ctz=America%2FNew_York/);
  });

  await test(".ics calendar file downloads", async () => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-ok-ics]")]);
    const file = await dl.path();
    const ics = fs.readFileSync(file, "utf8");
    assert.match(ics, /BEGIN:VEVENT/); assert.match(ics, /DTSTART;TZID=America\/New_York:\d{8}T\d{6}/);
  });

  await test("language toggle switches the whole page to Spanish and back", async () => {
    await page.click("[data-lang-toggle]");
    assert.equal(await page.getAttribute("html", "lang"), "es");
    assert.match(await page.locator(".hero-title").textContent(), /Su hogar/);
    assert.match(await page.locator("[data-ok-msg]").textContent(), /Le enviamos una confirmación/);
    await page.click("[data-ok-again]");
    assert.match(await page.locator(".svc-opt").first().textContent(), /Remodelación de baños/);
    await page.click("[data-lang-toggle]");
    assert.equal(await page.getAttribute("html", "lang"), "en");
    assert.match(await page.locator(".hero-title").textContent(), /Your home/);
  });

  await test("chat assistant answers instantly and suggests booking the right service", async () => {
    await page.click("[data-chat-open]");
    await page.waitForSelector(".msg-bot >> text=automated assistant");
    await page.fill("[data-chat-text]", "How much does a bathroom remodel cost?");
    await page.press("[data-chat-text]", "Enter");
    await page.waitForSelector(".msg-bot >> text=written estimate");
    assert.equal(await page.locator(".chat-quick button", { hasText: "Book Bathroom Remodeling" }).count(), 1);
    await page.fill("[data-chat-text]", "¿hacen pisos de cerámica?");
    await page.press("[data-chat-text]", "Enter");
    await page.waitForSelector(".msg-bot >> text=flooring");
  });

  await test("chat falls back to a callback form when it can't answer", async () => {
    await page.fill("[data-chat-text]", "Can you build a treehouse?");
    await page.press("[data-chat-text]", "Enter");
    await page.waitForSelector(".msg-form");
    await page.fill('.msg-form input[name="name"]', "Tom");
    await page.fill('.msg-form input[name="phone"]', "954-555-0000");
    await page.click(".msg-form button");
    await page.waitForSelector(".msg-bot >> text=We'll get back to you soon");
    assert.equal(sentForms.at(-1).body.Message, "Can you build a treehouse?");
    await page.click("[data-chat-close]");
  });

  await test("no errors during the whole desktop run", async () => { assert.deepEqual(errors, []); });

  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const p2 = await ctx.newPage();
    await p2.goto(BASE + "/index.html", { waitUntil: "networkidle" });
    await p2.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-in")));
    await p2.screenshot({ path: path.join(SHOTS, "desktop-full.png"), fullPage: true });
    await p2.screenshot({ path: path.join(SHOTS, "desktop-hero.png") });
  }
  await ctx.close();

  // ---------- Gallery with projects ----------
  const gctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const gp = await gctx.newPage();
  const gerr = watch(gp);
  await gp.route("**/js/projects.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.PROJECTS=[{category:"kitchen",title:{en:"White kitchen refresh",es:"Cocina blanca"},location:"Weston",photo:"images/hero-kitchen.webp",before:"images/hero-bath.webp",more:["images/hero-bath.webp"]},{category:"bathroom",title:"Spa bathroom",location:"Davie",photo:"images/hero-bath.webp"}];`
  }));
  await gp.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await test("gallery renders projects with filters", async () => {
    assert.equal(await gp.locator(".g-item:not(.g-placeholder)").count(), 2);
    await gp.click(".filter-btn >> text=Bathroom Remodeling");
    assert.equal(await gp.locator(".g-item").count(), 1);
    await gp.click(".filter-btn >> text=All");
  });
  await test("lightbox opens with a working before/after slider", async () => {
    await gp.locator(".g-item").first().click();
    await gp.waitForSelector("dialog[open] .compare");
    await gp.locator(".compare input[type=range]").fill("20");
    assert.equal(await gp.locator(".compare").evaluate((el) => el.style.getPropertyValue("--pos")), "20%");
    await gp.click("[data-lb-next]");
    await gp.waitForSelector("dialog[open] .lb-stage > img");
    if (SHOTS) await gp.screenshot({ path: path.join(SHOTS, "lightbox.png") });
    await gp.keyboard.press("Escape");
    assert.deepEqual(gerr, []);
  });
  if (SHOTS) {
    await gp.locator("#work").scrollIntoViewIfNeeded();
    await gp.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-in")));
    await gp.locator("#work").screenshot({ path: path.join(SHOTS, "gallery-with-projects.png") });
  }
  await gctx.close();

  // ---------- Apps Script backend mode ----------
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await actx.newPage();
  const aerr = watch(ap);
  let posted = null, busySlot = null;
  await ap.route("**/js/config.js", async (route) => {
    const res = await route.fetch();
    route.fulfill({ response: res, body: (await res.text()).replace('appsScriptUrl: ""', `appsScriptUrl: "${GAS}"`) });
  });
  await ap.route(GAS + "**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      // mark the first slot of the first open day as taken
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, busy: busySlot ? [busySlot] : [], closedDates: [] }) });
    }
    posted = JSON.parse(req.postData());
    assert.ok(!req.headers()["content-type"] || req.headers()["content-type"].startsWith("text/plain"), "simple CORS request");
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, ref: "JS-SRV123" }) });
  });
  // figure out the first open slot so we can mark it busy
  await ap.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  const first = await ap.evaluate(() => window.Booking.nextAvailable());
  busySlot = first.date + " " + first.time;
  await ap.reload({ waitUntil: "networkidle" });

  await test("backend mode: live availability hides taken times, photo upload shown", async () => {
    const next = await ap.evaluate(() => window.Booking.nextAvailable());
    assert.notEqual(next.date + " " + next.time, busySlot);
    assert.equal(await ap.locator("[data-photo-field]").isVisible(), false); // only on step 3
    await ap.locator('[data-book-service="kitchen"]').first().click();
    await ap.locator(`.cal-day[data-date="${first.date}"]`).click();
    assert.equal(await ap.locator(".slot").first().isDisabled(), true);
  });

  await test("backend mode: booking posts JSON with photos and shows server reference", async () => {
    await ap.locator(".slot:not([disabled])").first().click();
    await ap.click("[data-next]");
    assert.equal(await ap.locator("[data-photo-field]").isVisible(), true);
    await ap.setInputFiles("[data-photo-input]", path.join(__dirname, "..", "images", "apple-touch-icon.png"));
    await ap.waitForSelector(".thumb img");
    await ap.fill('textarea[name="details"]', "New shaker cabinets and quartz countertops.");
    await ap.fill('input[name="zip"]', "33326");
    await ap.click("[data-next]");
    await ap.fill('input[name="name"]', "Ana Perez");
    await ap.fill('input[name="phone"]', "(954) 555-0199");
    await ap.fill('input[name="email"]', "ana@example.com");
    await ap.click("[data-submit]");
    await ap.waitForSelector("[data-booking-success]:not([hidden])");
    assert.equal(await ap.locator("[data-ok-ref]").textContent(), "JS-SRV123");
    assert.equal(posted.type, "booking");
    assert.deepEqual(posted.services, ["kitchen"]);
    assert.equal(posted.photos.length, 1);
    assert.ok(posted.photos[0].data.length > 100);
    assert.deepEqual(aerr, []);
  });
  await actx.close();

  // ---------- Mobile ----------
  const mctx = await browser.newContext({ ...devices["iPhone 13"] });
  const mp = await mctx.newPage();
  const merr = watch(mp);
  await mp.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await test("mobile: no sideways scrolling, action bar visible, menu opens", async () => {
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, "horizontal overflow: " + overflow + "px");
    assert.equal(await mp.locator(".mobile-bar").isVisible(), true);
    await mp.click("[data-nav-toggle]");
    await mp.locator("#nav-links >> text=Services").waitFor({ state: "visible", timeout: 3000 });
    await mp.click("#nav-links >> text=Services");
    assert.deepEqual(merr, []);
  });
  if (SHOTS) {
    await mp.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll(".reveal").forEach((e) => e.classList.add("is-in")); });
    await mp.screenshot({ path: path.join(SHOTS, "mobile-full.png"), fullPage: true });
    await mp.screenshot({ path: path.join(SHOTS, "mobile-hero.png") });
    await mp.locator('[data-book-service="painting"]').first().click();
    await mp.waitForTimeout(800);
    await mp.locator("#booking").screenshot({ path: path.join(SHOTS, "mobile-booking.png") });
    await mp.click("[data-chat-open]");
    await mp.waitForSelector(".msg-bot >> text=automated assistant");
    await mp.fill("[data-chat-text]", "Do you do popcorn ceiling removal?");
    await mp.press("[data-chat-text]", "Enter");
    await mp.waitForTimeout(1000);
    await mp.screenshot({ path: path.join(SHOTS, "mobile-chat.png") });
  }
  await mctx.close();

  await browser.close();
  console.log(`\n${passed} website tests passed`);
})().catch((e) => { console.error("\n✗ FAILED:", e); process.exit(1); });
