# Booking backend setup (Google Apps Script) — about 10 minutes

This turns on the full booking system: live open times, Google Calendar events,
branded auto-reply emails (English/Spanish), photo uploads, one-click
**Confirm / Reschedule** buttons and next-day reminder emails. It's free and runs
on the business Google account.

> Until you do this, the website still works: bookings are emailed to
> `jclsanchez45@gmail.com` through FormSubmit.co and customers get an automatic
> reply. See "FormSubmit activation" in the main README.

## 1. Create the bookings spreadsheet
1. Sign in to Google as **jclsanchez45@gmail.com** (the calendar and emails will use this account).
2. Open <https://sheets.new> and name the sheet **J Sanchez – Website Bookings**.

## 2. Add the script
1. In the sheet: **Extensions → Apps Script**.
2. Delete everything in `Code.gs` and paste the contents of [`Code.gs`](Code.gs).
3. Click the gear (**Project Settings**) → tick **Show "appsscript.json" manifest file** →
   back in the editor open `appsscript.json` and replace it with [`appsscript.json`](appsscript.json)
   (this sets the time zone to Eastern).
4. At the top of `Code.gs`, check the `CONFIG` block (phone, email, time slots). Once you have
   your domain, put it in `SITE_URL`.
5. Click **Save** (disk icon).

## 3. Run setup once
1. In the function menu next to **Run**, choose **`setup`**, then click **Run**.
2. Google asks for permission → **Review permissions** → choose the account →
   **Advanced → Go to project (unsafe)** → **Allow**. (It says "unsafe" only because it's
   your own private script, not a published app.)
3. The sheet now has **Bookings** and **Messages** tabs, and a daily 9 AM reminder job is installed.

## 4. Publish it as a web app
1. **Deploy → New deployment** → gear icon → **Web app**.
2. Execute as: **Me** · Who has access: **Anyone** → **Deploy**.
3. Copy the **Web app URL** (it ends in `/exec`).

## 5. Connect the website
Open `js/config.js` and paste the URL:

```js
appsScriptUrl: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

Commit/upload the change. Done — make a test booking on the site and check:
- a new row in **Bookings**, a yellow event on Google Calendar,
- the customer confirmation email, and your notification email with **Confirm visit**.

## Everyday use
| You want to… | Do this |
|---|---|
| Confirm a visit | Click **Confirm visit** in the notification email (customer gets a confirmation, event turns green) |
| Ask to reschedule | Click **Need to reschedule** (customer is emailed, time slot opens back up) |
| Take a day off | Add an all-day event called **OFF** (or "Closed", "Vacation") to your Google Calendar |
| Block a few hours | Any normal event on your calendar automatically blocks overlapping times |
| See all bookings | Open the **Bookings** tab of the sheet; change the Status column any time |

## Changing hours or time slots
Change them in **both** places so they match:
- `js/config.js` → `slots`, `saturdaySlots`, `closedWeekdays`
- `Code.gs` → `SLOTS`, `SATURDAY_SLOTS`, `CLOSED_WEEKDAYS`

After editing `Code.gs`, publish the change: **Deploy → Manage deployments → ✏️ Edit →
Version: New version → Deploy** (the URL stays the same).

## Limits
Free Gmail accounts can send about 100 emails a day from scripts. Each booking uses 2 (customer + you),
so that's roughly 50 bookings a day — plenty for a growing business.
