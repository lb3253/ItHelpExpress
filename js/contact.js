/* ==========================================================================
   ItHelpExpress — contact.js
   Contact form validation + AI triage of the inquiry.
   ========================================================================== */

/* ⚠️  REPLACE THIS WITH YOUR ANTHROPIC API KEY ⚠️
   -------------------------------------------------------------------------
   SECURITY WARNING: a key placed here is downloaded by every visitor and is
   readable in "View Source" and the browser's Network tab. Anyone can copy it
   and spend against your account.

   Fine for local testing and demos. Before you take real traffic, move these
   calls behind a serverless function (Cloudflare Pages Functions or Netlify
   Functions), keep the key in that platform's environment variables, and point
   API_ENDPOINT below at your own /api/triage route instead of api.anthropic.com.
   ------------------------------------------------------------------------- */
/* Scoped so that pages loading more than one of these files (the homepage
   loads contact.js and chat.js together) don't collide on the name. */
(function () {
  'use strict';

const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

/* The triage instruction, plus an output contract so we can render the note
   for the team and a friendly version for the client from a single call. */
const TRIAGE_PROMPT =
  'Based on this client inquiry, write a short internal triage note for the IT ' +
  'team. Identify: urgency level (low/medium/high), most likely plan fit ' +
  '(Starter/Business/Growth), and a suggested first response. Keep it to 3 ' +
  'bullet points.\n\n' +
  'Then rewrite those same three points so they can be shown to the client ' +
  'under the heading "Here\'s what to expect:" — warm, plain-spoken, second ' +
  'person ("you"/"we"), no internal jargon, no urgency labels, no plan-fit ' +
  'scoring language. Frame them as what happens next.\n\n' +
  'Reply with JSON only, no prose or code fences, in exactly this shape:\n' +
  '{"urgency":"low|medium|high","plan":"Starter|Business|Growth",' +
  '"internal":["...","...","..."],"client":["...","...","..."]}';

  var PLAN_PRICES = { Starter: '$99/mo', Business: '$249/mo', Growth: '$449/mo' };

  var form, panel, confirmation;

  /* ------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------ */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function fieldWrap(input) {
    return input.closest('.field');
  }

  function setError(input, message) {
    var wrap = fieldWrap(input);
    if (!wrap) return;
    wrap.classList.add('has-error');
    var msg = wrap.querySelector('.error-msg');
    if (msg) msg.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    var wrap = fieldWrap(input);
    if (!wrap) return;
    wrap.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
  }

  function validateField(input) {
    var value = String(input.value || '').trim();

    if (input.hasAttribute('required') && !value) {
      setError(input, 'This field is required.');
      return false;
    }

    if (input.type === 'email' && value && !EMAIL_RE.test(value)) {
      setError(input, 'Enter a valid email address, like you@yourbusiness.com.');
      return false;
    }

    if (input.type === 'tel' && value) {
      var digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        setError(input, 'Enter a 10-digit phone number.');
        return false;
      }
    }

    if (input.name === 'devices' && value) {
      var n = Number(value);
      if (!Number.isFinite(n) || n < 1) {
        setError(input, 'Enter the number of devices (1 or more).');
        return false;
      }
    }

    clearError(input);
    return true;
  }

  function validateForm() {
    var fields = form.querySelectorAll('input[name], select[name], textarea[name]');
    var firstBad = null;
    var ok = true;

    Array.prototype.forEach.call(fields, function (input) {
      if (input.type === 'radio') return; // handled below
      if (!validateField(input)) {
        ok = false;
        if (!firstBad) firstBad = input;
      }
    });

    // Preferred contact method — at least one radio must be picked.
    var radios = form.querySelectorAll('input[name="contactMethod"]');
    if (radios.length) {
      var picked = Array.prototype.some.call(radios, function (r) { return r.checked; });
      var group = radios[0].closest('.field');
      if (!picked) {
        ok = false;
        if (group) {
          group.classList.add('has-error');
          var msg = group.querySelector('.error-msg');
          if (msg) msg.textContent = 'Pick how you would like us to reach you.';
        }
        if (!firstBad) firstBad = radios[0];
      } else if (group) {
        group.classList.remove('has-error');
      }
    }

    if (firstBad) {
      firstBad.focus();
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return ok;
  }

  /* ------------------------------------------------------------------
     Submission
     ------------------------------------------------------------------ */
  function collect() {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) { data[key] = String(value).trim(); });
    return data;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    var data = collect();
    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    // NOTE: this demo does not persist the inquiry anywhere. Wire the object
    // below up to your inbox — Formspree, a Cloudflare Pages Function, etc.
    console.log('[ItHelpExpress] New inquiry:', data);

    showConfirmation(data);

    triage(data)
      .then(function (result) { renderTriage(result); })
      .catch(function () { renderTriageFallback(); });
  }

  function showConfirmation(data) {
    var name = (data.fullName || '').split(' ')[0] || 'there';

    form.hidden = true;
    if (panel) panel.hidden = true;

    confirmation.hidden = false;
    confirmation.querySelector('#confirmName').textContent = name;
    confirmation.focus();
    confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ------------------------------------------------------------------
     AI triage
     ------------------------------------------------------------------ */
  function inquiryText(d) {
    return [
      'Name: ' + (d.fullName || '—'),
      'Business: ' + (d.businessName || '—'),
      'Email: ' + (d.email || '—'),
      'Phone: ' + (d.phone || '—'),
      'Number of devices: ' + (d.devices || '—'),
      'Main IT problem: ' + (d.problem || '—'),
      'Preferred contact method: ' + (d.contactMethod || '—'),
      'Message: ' + (d.message || '(none)')
    ].join('\n');
  }

  function triage(data) {
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'YOUR_API_KEY_HERE') {
      return Promise.reject(new Error('API key not configured'));
    }

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: TRIAGE_PROMPT,
        messages: [{ role: 'user', content: inquiryText(data) }]
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        var text = (payload.content || [])
          .filter(function (b) { return b.type === 'text'; })
          .map(function (b) { return b.text; })
          .join('')
          .trim();

        // Tolerate a stray code fence or surrounding prose.
        var start = text.indexOf('{');
        var end = text.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('Unexpected response shape');

        var parsed = JSON.parse(text.slice(start, end + 1));
        if (!parsed.client || !parsed.client.length) throw new Error('No client bullets');

        // The internal note is for the team — surface it in the console so it
        // can be forwarded, and keep it off the client-facing screen.
        console.log(
          '[ItHelpExpress] Triage — urgency: %s | likely plan: %s\n- %s',
          parsed.urgency, parsed.plan, (parsed.internal || []).join('\n- ')
        );

        return parsed;
      });
  }

  function renderTriage(result) {
    var box = document.getElementById('triageBox');
    if (!box) return;

    var list = document.createElement('ul');
    result.client.slice(0, 4).forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = String(line).replace(/^[-•*]\s*/, '');
      list.appendChild(li);
    });

    var loading = box.querySelector('.loading-line');
    if (loading) loading.remove();
    box.appendChild(list);

    // Point them at the plan the triage landed on.
    if (result.plan && PLAN_PRICES[result.plan]) {
      var cta = document.createElement('p');
      cta.className = 'mt-4';
      cta.style.fontSize = '0.875rem';
      cta.innerHTML =
        'Based on what you told us, the <strong>' + result.plan + '</strong> plan (' +
        PLAN_PRICES[result.plan] + ') looks like the closest fit. ' +
        '<a href="pricing.html">See what it includes →</a>';
      box.appendChild(cta);
    }
  }

  function renderTriageFallback() {
    var box = document.getElementById('triageBox');
    if (!box) return;

    var loading = box.querySelector('.loading-line');
    if (loading) loading.remove();

    var list = document.createElement('ul');
    [
      'A real person reads your message — no ticket queue, no phone tree.',
      'We reply within one business hour with a couple of quick questions and a straight answer on what it would cost.',
      'If it is something we can fix remotely, we will often knock it out on that first call.'
    ].forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });
    box.appendChild(list);
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    form = document.getElementById('contactForm');
    confirmation = document.getElementById('confirmation');
    if (!form || !confirmation) return;

    panel = document.getElementById('contactFormPanel');

    form.setAttribute('novalidate', 'novalidate');
    form.addEventListener('submit', handleSubmit);

    // Clear the error state as soon as the visitor fixes the field.
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('input, select, textarea')) {
        var wrap = fieldWrap(t);
        if (wrap && wrap.classList.contains('has-error')) validateField(t);
      }
    });

    form.addEventListener('blur', function (e) {
      var t = e.target;
      if (t.matches('input[name], select[name], textarea[name]') && t.type !== 'radio') {
        validateField(t);
      }
    }, true);

    form.addEventListener('change', function (e) {
      if (e.target.name === 'contactMethod') {
        var group = e.target.closest('.field');
        if (group) group.classList.remove('has-error');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
