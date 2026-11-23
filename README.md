# J Sanchez Home Improvements LLC — website

Modern, mobile-first, bilingual (English / Español) website for J Sanchez Home Improvements,
with online booking, automatic replies and a finished-jobs photo gallery.
Plain HTML/CSS/JS, so there's no build step: it runs on any static host (GitHub Pages, Netlify, Cloudflare Pages).

## What's included
- **All services**: Bathroom & Kitchen Remodeling, Flooring, Ceiling Work, Interior Painting, Plumbing, Electrical, plus "something else".
- **Online booking (4 steps)**: service → day & time → project details (+ photos) → contact info.
  Closed days, lead time and already-booked times are blocked automatically.
- **Automatic replies**:
  - an instant on-screen confirmation with a reference number, *Add to Google Calendar*, an Apple/Outlook `.ics` file and *Text us photos*;
  - an instant email to the customer (English or Spanish) and a notification email to the owner;
  - with the Apps Script backend: Google Calendar events, one-click Confirm/Reschedule emails and next-day reminders.
- **Chat assistant**: answers common questions instantly in English or Spanish (services, pricing, hours, area,
  photos, emergencies), sends people to the right booking option, and takes a callback request when it can't answer.
  No AI account or API key needed. The answers are in `js/chat.js`.
- **Finished jobs gallery**: category filters, full-screen viewer, and a drag-to-compare before/after slider.
- **Language toggle** (EN/ES), tap-to-call / text / WhatsApp, sticky mobile action bar.
- SEO basics: Google "local business" data, share image, fast self-hosted fonts.

## Edit the basics → `js/config.js`
Phone, email, hours, cities served, Spanish badge, Florida license number, social links,
and booking rules (time slots, closed days, how far ahead people can book).

## Add finished-job photos → `js/projects.js`
1. Put photos in `images/projects/` (JPG/WebP, ~1600px wide).
2. Copy the example block in `js/projects.js`, remove the `//`, and fill in category, title, city and photo.
   Add a `before:` photo to get the before/after slider.
Until you add projects, the gallery shows "Photos coming soon" tiles.

## Booking: how requests reach you
| Mode | Setup | What you get |
|---|---|---|
| **FormSubmit (default)** | none — works out of the box | Booking emailed to `jclsanchez45@gmail.com` + automatic reply email to the customer |
| **Google Apps Script (recommended)** | ~10 min, see [`backend/apps-script/SETUP.md`](backend/apps-script/SETUP.md) | Everything above **plus** Google Sheet log, Google Calendar events, live availability (no double bookings), photo uploads to Drive, Confirm/Reschedule buttons, reminder emails |

**FormSubmit activation (one time):** right after the site goes live, make one test booking yourself.
FormSubmit sends an **"Activate Form"** email to `jclsanchez45@gmail.com`; click it.
From then on every booking arrives by email. (Bookings made before activation are not delivered.)

## Live site & updates
The site is live at **https://m9escalante-spec.github.io/jsanchez-home-improvements/**.
Every push to `main` runs the backend tests and republishes the site through
`.github/workflows/deploy.yml`, which copies the public files to the `gh-pages` branch
that GitHub Pages serves. Don't edit `gh-pages` by hand: each deploy replaces it.

**Alternative, no GitHub:** drag the site files onto <https://app.netlify.com/drop> to get a live link in seconds.

## Custom domain
1. Buy the domain (Cloudflare Registrar, Namecheap, Porkbun, Squarespace Domains…).
2. At the domain's DNS settings add:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `m9escalante-spec.github.io`
3. In this repo, add a file named `CNAME` (no extension) on `main` containing just the domain, e.g. `jsanchezhomes.com`,
   and push. The deploy copies it to `gh-pages` (setting the domain only in GitHub's Settings page would be wiped by the next deploy).
4. In **Settings → Pages**, tick **Enforce HTTPS** once the certificate is ready (can take up to an hour).
5. Update the domain in `backend/apps-script/Code.gs` (`SITE_URL`) and use full URLs for `og:image` in `index.html`.

## Before launch — please confirm
These are reasonable defaults; change anything that isn't right in `js/config.js` / `index.html`:
- Hours **Mon–Sat 8 AM–6 PM**, Sundays closed; estimate visits at 8, 10, 12, 2, 4 (Saturdays 8–12).
- Service area **Broward County** (from the 954 area code) and the list of cities.
- **"Se habla español"** badge (set `speaksSpanish: false` if not).
- **Florida license number**: Florida requires licensed contractors to show it in ads, and plumbing/electrical
  work generally needs a licensed contractor. Add it to `licenseNumber` if you hold one.
- The two hero photos are cropped from the company flyer; swap in real project photos any time
  (`images/hero-kitchen.webp`, `images/hero-bath.webp`).

## Run & test locally
```bash
python3 -m http.server 8765        # then open http://localhost:8765
TZ=America/New_York node tests/apps-script.test.mjs                  # backend tests (Node 18+)
BASE=http://localhost:8765 node tests/site.test.js                     # browser tests (needs Playwright)
```

## Files
```
index.html                 the page
css/styles.css             design (navy + gold brand)
js/config.js               ← business info & booking rules
js/projects.js             ← finished-job photos
js/i18n.js                 Spanish translations
js/booking.js              booking wizard + auto-replies
js/chat.js                 chat assistant answers
js/main.js                 menu, gallery, animations
backend/apps-script/       optional Google backend + setup guide
tests/                     automated tests
```
