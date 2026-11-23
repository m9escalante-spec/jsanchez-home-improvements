/* ==========================================================================
   SITE SETTINGS — edit this file to change business info and booking rules.
   Everything else on the site reads from here.
   ========================================================================== */
window.SITE = {
  business: {
    name: "J Sanchez Home Improvements LLC",
    shortName: "J Sanchez",
    tagline: "Your Home, Our Commitment",
    phone: "954-295-7763",          // shown on the site
    phoneE164: "+19542957763",      // used for tap-to-call / text links
    whatsapp: "19542957763",        // digits only, with country code
    email: "jclsanchez45@gmail.com",
    area: "Broward County, FL",
    cities: [
      "Fort Lauderdale", "Hollywood", "Pembroke Pines", "Miramar", "Coral Springs",
      "Davie", "Plantation", "Sunrise", "Weston", "Pompano Beach", "Tamarac",
      "Margate", "Coconut Creek", "Lauderhill", "Deerfield Beach", "Cooper City"
    ],
    hours: {
      en: "Mon–Sat · 8:00 AM – 6:00 PM",
      es: "Lun–Sáb · 8:00 AM – 6:00 PM"
    },
    speaksSpanish: true,            // shows the "Se habla español" badge
    licenseNumber: "",              // e.g. "CBC1234567" — Florida requires it on ads if you hold a license
    social: { facebook: "", instagram: "", google: "" } // paste full URLs to show icons
  },

  booking: {
    /* 1) RECOMMENDED: paste your Google Apps Script Web App URL here
          (see backend/apps-script/SETUP.md). Gives you live availability,
          Google Calendar events, branded auto-reply emails, photo uploads,
          one-click confirm links and next-day reminders. */
    appsScriptUrl: "",

    /* 2) ZERO-SETUP FALLBACK: used when appsScriptUrl is empty.
          Requests are emailed to this address through FormSubmit.co and the
          customer gets an automatic reply. The very first request triggers an
          activation email from FormSubmit — click "Activate" once. */
    formsubmitEmail: "jclsanchez45@gmail.com",

    timezone: "America/New_York",
    daysAhead: 42,                  // how far ahead customers can book
    minLeadHours: 16,               // no bookings sooner than this
    closedWeekdays: [0],            // 0 = Sunday … 6 = Saturday
    slots: ["08:00", "10:00", "12:00", "14:00", "16:00"], // estimate visit start times
    saturdaySlots: ["08:00", "10:00", "12:00"],          // shorter Saturdays (set to null to use "slots")
    visitMinutes: 90,
    blackoutDates: [],              // e.g. ["2026-12-25", "2027-01-01"]
    maxPhotos: 4
  },

  services: [
    { id: "bathroom",   icon: "i-bath",    en: "Bathroom Remodeling", es: "Remodelación de baños" },
    { id: "kitchen",    icon: "i-kitchen", en: "Kitchen Remodeling",  es: "Remodelación de cocinas" },
    { id: "flooring",   icon: "i-floor",   en: "Flooring",            es: "Pisos" },
    { id: "ceiling",    icon: "i-ceiling", en: "Ceiling Work",        es: "Techos y cielo raso" },
    { id: "painting",   icon: "i-roller",  en: "Interior Painting",   es: "Pintura interior" },
    { id: "plumbing",   icon: "i-faucet",  en: "Plumbing",            es: "Plomería" },
    { id: "electrical", icon: "i-bolt",    en: "Electrical",          es: "Electricidad" },
    { id: "other",      icon: "i-wrench",  en: "Other / Repairs",     es: "Otro / Reparaciones" }
  ]
};
