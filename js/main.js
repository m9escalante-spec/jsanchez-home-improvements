/* ==========================================================================
   Page behavior: language, navigation, reveal animations, service areas,
   finished-jobs gallery + lightbox with before/after slider.
   ========================================================================== */
(function () {
  "use strict";
  var SITE = window.SITE, B = SITE.business;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (k, v) { return window.i18n.t(k, v); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var icon = function (id) { return '<svg class="ic" aria-hidden="true"><use href="#' + id + '"/></svg>'; };

  /* ---------- Language ---------- */
  function syncLanguageBits() {
    $$("[data-lang-toggle]").forEach(function (btn) {
      $("[data-lang-label]", btn).textContent = t("lang.label");
      btn.setAttribute("aria-label", t("lang.aria"));
    });
    $$("[data-hours]").forEach(function (el) { el.textContent = B.hours[window.i18n.lang] || B.hours.en; });
    $$("[data-sms-link]").forEach(function (a) { a.href = smsHref(t("sms.hello")); });
    $$("[data-wa-link]").forEach(function (a) { a.href = "https://wa.me/" + B.whatsapp + "?text=" + encodeURIComponent(t("sms.hello")); });
  }
  $$("[data-lang-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () { window.i18n.set(window.i18n.lang === "es" ? "en" : "es"); });
  });

  function smsHref(body) {
    // "?&body=" works on both iOS and Android
    return "sms:" + B.phoneE164 + "?&body=" + encodeURIComponent(body);
  }
  window.JSH = { smsHref: smsHref, esc: esc, icon: icon };

  /* ---------- Business details from config ---------- */
  if (!B.speaksSpanish) $$("[data-spanish-only]").forEach(function (el) { el.hidden = true; });
  if (B.licenseNumber) {
    var lic = $("[data-license]");
    lic.textContent = "Florida License # " + B.licenseNumber;
    lic.hidden = false;
  }
  var social = $("[data-social]");
  [["facebook", "f", "Facebook"], ["instagram", "IG", "Instagram"], ["google", "G", "Google reviews"]].forEach(function (s) {
    if (!B.social[s[0]]) return;
    var a = document.createElement("a");
    a.href = B.social[s[0]]; a.target = "_blank"; a.rel = "noopener"; a.textContent = s[1]; a.setAttribute("aria-label", s[2]);
    social.appendChild(a);
  });
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  var cityList = $("[data-cities]");
  B.cities.forEach(function (c) {
    var li = document.createElement("li");
    li.innerHTML = icon("i-pin") + "<span>" + esc(c) + "</span>";
    cityList.appendChild(li);
  });

  /* ---------- Navigation ---------- */
  var nav = $("[data-nav]"), toggle = $("[data-nav-toggle]");
  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  function closeMenu() { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("#nav-links a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  /* ---------- Reveal on scroll ---------- */
  var groups = new Map();
  $$(".reveal").forEach(function (el) {
    var parent = el.parentElement, n = groups.get(parent) || 0;
    el.style.transitionDelay = Math.min(n, 5) * 70 + "ms";
    groups.set(parent, n + 1);
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    $$(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Gallery ---------- */
  var ORDER = ["bathroom", "kitchen", "flooring", "ceiling", "painting", "plumbing", "electrical", "other"];
  var projects = (window.PROJECTS || []).filter(function (p) { return p && p.photo; });
  var filterBox = $("[data-gallery-filters]"), grid = $("[data-gallery]"), emptyNote = $("[data-gallery-empty]");
  var activeFilter = "all";

  function svc(id) { return SITE.services.filter(function (s) { return s.id === id; })[0] || SITE.services[SITE.services.length - 1]; }
  function svcName(id) { return svc(id)[window.i18n.lang]; }
  function txt(v) { return v && typeof v === "object" ? (v[window.i18n.lang] || v.en || "") : (v || ""); }

  function renderFilters() {
    filterBox.innerHTML = "";
    if (!projects.length) { filterBox.hidden = true; return; }
    filterBox.hidden = false;
    var cats = ORDER.filter(function (c) { return projects.some(function (p) { return p.category === c; }); });
    ["all"].concat(cats).forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "filter-btn";
      b.textContent = c === "all" ? t("all") : svcName(c);
      b.setAttribute("aria-pressed", String(c === activeFilter));
      b.addEventListener("click", function () { activeFilter = c; renderFilters(); renderGallery(); });
      filterBox.appendChild(b);
    });
  }

  var visible = []; // projects currently shown, for lightbox navigation
  function renderGallery() {
    grid.innerHTML = "";
    if (!projects.length) {
      emptyNote.hidden = false;
      ["bathroom", "kitchen", "flooring", "painting", "ceiling", "electrical"].forEach(function (c) {
        var d = document.createElement("div");
        d.className = "g-item g-placeholder";
        d.innerHTML = '<div class="ph-inner"><span class="ph-icon">' + icon(svc(c).icon) + "</span><strong>" + esc(svcName(c)) +
          "</strong><small>" + esc(t("soon")) + "</small></div>";
        grid.appendChild(d);
      });
      return;
    }
    emptyNote.hidden = true;
    visible = projects.filter(function (p) { return activeFilter === "all" || p.category === activeFilter; });
    visible.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "g-item";
      var title = txt(p.title) || svcName(p.category);
      var count = 1 + (p.before ? 1 : 0) + (p.more ? p.more.length : 0);
      b.setAttribute("aria-label", t("view") + ": " + title);
      b.innerHTML =
        '<img src="' + esc(p.photo) + '" alt="' + esc(title) + '" loading="lazy" decoding="async">' +
        '<span class="g-badge">' + icon(svc(p.category).icon) + esc(svcName(p.category)) + "</span>" +
        (p.before ? '<span class="g-badge g-badge-right">' + icon("i-compare") + esc(t("compare")) + "</span>" : "") +
        '<span class="g-meta"><strong>' + esc(title) + "</strong>" +
        "<small>" + (p.location ? icon("i-pin") + esc(p.location) + " · " : "") + icon("i-image") + esc(t("photos.count", { n: count })) + "</small></span>";
      b.addEventListener("click", function () { openLightbox(i, 0); });
      grid.appendChild(b);
    });
  }

  /* ---------- Lightbox ---------- */
  var lb = $("[data-lightbox]"), stage = $("[data-lb-stage]"), caption = $("[data-lb-caption]");
  var cur = { p: 0, s: 0 };

  function slidesOf(p) {
    var s = [];
    s.push(p.before ? { type: "compare", before: p.before, after: p.photo } : { type: "img", src: p.photo });
    (p.more || []).forEach(function (src) { s.push({ type: "img", src: src }); });
    return s;
  }

  function showSlide() {
    var p = visible[cur.p]; if (!p) return;
    var slides = slidesOf(p), sl = slides[cur.s];
    var title = txt(p.title) || svcName(p.category);
    stage.innerHTML = "";
    if (sl.type === "compare") {
      var c = document.createElement("div");
      c.className = "compare"; c.style.setProperty("--pos", "50%");
      c.innerHTML =
        '<img class="before" src="' + esc(sl.before) + '" alt="' + esc(t("before") + " — " + title) + '">' +
        '<img class="after" src="' + esc(sl.after) + '" alt="' + esc(t("after") + " — " + title) + '">' +
        '<span class="tag tag-before">' + esc(t("before")) + '</span><span class="tag tag-after">' + esc(t("after")) + "</span>" +
        '<span class="handle"></span><input type="range" min="0" max="100" value="50" aria-label="' + esc(t("compare")) + '">';
      var range = $("input", c);
      range.addEventListener("input", function () { c.style.setProperty("--pos", range.value + "%"); });
      $(".after", c).addEventListener("load", function (e) {
        var im = e.target; if (im.naturalWidth) c.style.setProperty("--ar", im.naturalWidth + " / " + im.naturalHeight);
      });
      stage.appendChild(c);
    } else {
      var img = document.createElement("img");
      img.src = sl.src; img.alt = title;
      stage.appendChild(img);
    }
    caption.textContent = title + (p.location ? " · " + p.location : "") + "  (" + (cur.s + 1) + "/" + slides.length + ")";
  }

  function step(dir) {
    var slides = slidesOf(visible[cur.p]);
    cur.s += dir;
    if (cur.s >= slides.length) { cur.p = (cur.p + 1) % visible.length; cur.s = 0; }
    else if (cur.s < 0) { cur.p = (cur.p - 1 + visible.length) % visible.length; cur.s = slidesOf(visible[cur.p]).length - 1; }
    showSlide();
  }

  function openLightbox(pi, si) {
    cur = { p: pi, s: si || 0 };
    showSlide();
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  }
  function closeLightbox() { if (typeof lb.close === "function") lb.close(); else lb.removeAttribute("open"); }
  $("[data-lb-close]").addEventListener("click", closeLightbox);
  $("[data-lb-prev]").addEventListener("click", function () { step(-1); });
  $("[data-lb-next]").addEventListener("click", function () { step(1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  lb.addEventListener("keydown", function (e) {
    if (e.target.matches && e.target.matches("input[type=range]")) return;
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
  // swipe on touch screens
  var touchX = null;
  stage.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (touchX == null || (e.target.matches && e.target.matches("input[type=range]"))) { touchX = null; return; }
    var dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  /* ---------- Init + language refresh ---------- */
  function renderAll() { syncLanguageBits(); renderFilters(); renderGallery(); }
  document.addEventListener("langchange", renderAll);
  renderAll();
})();
