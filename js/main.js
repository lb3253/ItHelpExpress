/* ==========================================================================
   ItHelpExpress — main.js
   Navigation, smooth scroll, scroll reveals, IT Health Score animation,
   and the pricing toggle.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Mobile navigation
     ------------------------------------------------------------------ */
  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the menu after tapping a link on mobile.
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ------------------------------------------------------------------
     Active nav link — highlights the current page
     ------------------------------------------------------------------ */
  function initActiveLink() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.nav-links a');

    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute('href');
      if (!href) return;

      // Same-page anchors (e.g. "#pricing") only count on the homepage.
      if (href.charAt(0) === '#') {
        if (path === 'index.html' || path === '') return;
        return;
      }

      var target = href.split('#')[0];
      if (target === path) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  /* ------------------------------------------------------------------
     Smooth scroll for in-page anchors
     (CSS scroll-behavior handles most of this; this covers focus
     management and browsers without support.)
     ------------------------------------------------------------------ */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var anchor = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!anchor) return;

      var id = anchor.getAttribute('href');
      if (!id || id === '#') return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Move keyboard focus to the destination for accessibility.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      window.setTimeout(function () { target.focus({ preventScroll: true }); }, 420);

      if (history.pushState) history.pushState(null, '', id);
    });
  }

  /* ------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------ */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    Array.prototype.forEach.call(items, function (el) { observer.observe(el); });
  }

  /* ------------------------------------------------------------------
     IT Health Score — animates 0 → 94% on page load
     ------------------------------------------------------------------ */
  function initHealthScore() {
    var ring = document.getElementById('gaugeFill');
    var numberEl = document.getElementById('gaugeNumber');
    if (!ring || !numberEl) return;

    var TARGET = 94;
    var DURATION = 2200; // ms
    var radius = Number(ring.getAttribute('r')) || 56;
    var circumference = 2 * Math.PI * radius;

    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);

    // Each metric row lights up as the score sweeps past its threshold.
    var metrics = Array.prototype.slice.call(
      document.querySelectorAll('.metric-row[data-at]')
    );

    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function paint(value) {
      var pct = Math.max(0, Math.min(100, value));
      numberEl.textContent = Math.round(pct) + '%';
      ring.style.strokeDashoffset = String(circumference * (1 - pct / 100));

      metrics.forEach(function (row) {
        var at = Number(row.getAttribute('data-at'));
        if (pct >= at) {
          row.classList.add(row.getAttribute('data-state') === 'warn' ? 'is-warn' : 'is-on');
        }
      });
    }

    if (prefersReduced) {
      paint(TARGET);
      return;
    }

    // easeOutCubic — quick sweep that settles gently on the final number.
    function ease(t) { return 1 - Math.pow(1 - t, 3); }

    var start = null;
    function frame(timestamp) {
      if (start === null) start = timestamp;
      var elapsed = timestamp - start;
      var progress = Math.min(elapsed / DURATION, 1);
      paint(TARGET * ease(progress));
      if (progress < 1) window.requestAnimationFrame(frame);
    }

    // Small delay so the animation is visible after paint.
    window.setTimeout(function () { window.requestAnimationFrame(frame); }, 320);
  }

  /* ------------------------------------------------------------------
     Pricing view toggle (Monthly / Annual)
     ------------------------------------------------------------------ */
  function initPricingToggle() {
    var toggle = document.querySelector('.billing-toggle');
    if (!toggle) return;

    var buttons = toggle.querySelectorAll('button[data-billing]');
    var amounts = document.querySelectorAll('[data-monthly]');

    function apply(mode) {
      Array.prototype.forEach.call(buttons, function (btn) {
        var isActive = btn.getAttribute('data-billing') === mode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
      });

      Array.prototype.forEach.call(amounts, function (el) {
        var monthly = Number(el.getAttribute('data-monthly'));
        var note = el.parentElement
          ? el.parentElement.parentElement.querySelector('.plan__sub')
          : null;

        if (mode === 'annual') {
          // Two months free when paid up front.
          var perMonth = Math.round(monthly * 10 / 12);
          el.textContent = '$' + perMonth;
          if (note) {
            note.textContent = '$' + (monthly * 10).toLocaleString() +
              ' billed yearly — 2 months free';
          }
        } else {
          el.textContent = '$' + monthly;
          if (note) note.textContent = 'No contract. Cancel anytime.';
        }
      });
    }

    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-billing'));
      });
    });

    apply('monthly');
  }

  /* ------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------ */
  function initYear() {
    var el = document.getElementById('footerYear');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    initNav();
    initActiveLink();
    initSmoothScroll();
    initReveal();
    initHealthScore();
    initPricingToggle();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
