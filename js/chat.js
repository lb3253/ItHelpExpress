/* ==========================================================================
   ItHelpExpress — chat.js
   Floating "Ask IT" AI chat widget. Loaded on every page.
   ========================================================================== */

/* ⚠️  REPLACE THIS WITH YOUR ANTHROPIC API KEY ⚠️
   -------------------------------------------------------------------------
   SECURITY WARNING: a key placed here is downloaded by every visitor and is
   readable in "View Source" and the browser's Network tab. Anyone can copy it
   and spend against your account.

   Fine for local testing and demos. Before you take real traffic, move these
   calls behind a serverless function (Cloudflare Pages Functions or Netlify
   Functions), keep the key in that platform's environment variables, and point
   API_ENDPOINT below at your own /api/chat route instead of api.anthropic.com.
   ------------------------------------------------------------------------- */
/* Scoped so that pages loading more than one of these files (the homepage
   loads chat.js and contact.js together) don't collide on the name. */
(function () {
  'use strict';

const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT =
  'You are an IT support assistant for ItHelpExpress, a budget IT services ' +
  'company for small businesses in the DFW area. Answer questions about our ' +
  'services, pricing, and common IT problems. Be friendly, plain-spoken, and ' +
  'helpful. If someone has an urgent IT emergency, tell them to call or text ' +
  'us directly. Never make up prices — refer them to our pricing page if ' +
  'unsure. Keep answers short and practical.';

const GREETING =
  "Hey! I'm the ItHelpExpress assistant. Ask me about our plans, response " +
  'times, or whatever tech problem is bugging you today.';

const SUGGESTIONS = [
  "What's included in the Business plan?",
  'Do you offer same-day support?',
  'Can you help with Wi-Fi issues?',
  'How does the AI automation work?'
];

  var els = {};
  var history = [];   // [{ role: 'user' | 'assistant', content: string }]
  var busy = false;
  var greeted = false;

  /* ------------------------------------------------------------------
     Markup
     ------------------------------------------------------------------ */
  function build() {
    var launcher = document.createElement('button');
    launcher.className = 'chat-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Open the Ask IT chat assistant');
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      '</svg><span>Ask IT</span>';

    var panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Ask IT — ItHelpExpress assistant');
    panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = [
      '<div class="chat-header">',
      '  <div>',
      '    <div class="chat-header__title">',
      '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v1H7a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-2V5a3 3 0 0 0-3-3z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>',
      '      Ask IT',
      '    </div>',
      '    <div class="chat-header__status"><span class="dot"></span> AI assistant &middot; replies in seconds</div>',
      '  </div>',
      '  <button type="button" class="chat-close" aria-label="Close chat">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      '  </button>',
      '</div>',
      '<div class="chat-log" id="chatLog" role="log" aria-live="polite" aria-atomic="false"></div>',
      '<div class="chat-suggestions" id="chatSuggestions"></div>',
      '<form class="chat-form" id="chatForm" autocomplete="off">',
      '  <label class="sr-only" for="chatInput">Type your question</label>',
      '  <input type="text" id="chatInput" placeholder="Ask about plans, pricing, or a tech problem&hellip;" maxlength="600" />',
      '  <button type="submit" class="chat-send" id="chatSend" aria-label="Send message">',
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>',
      '  </button>',
      '</form>'
    ].join('');

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    els.launcher = launcher;
    els.panel = panel;
    els.log = panel.querySelector('#chatLog');
    els.suggestions = panel.querySelector('#chatSuggestions');
    els.form = panel.querySelector('#chatForm');
    els.input = panel.querySelector('#chatInput');
    els.send = panel.querySelector('#chatSend');
    els.close = panel.querySelector('.chat-close');
  }

  /* ------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------ */
  function addMessage(role, text, isError) {
    var wrap = document.createElement('div');
    wrap.className = 'chat-msg chat-msg--' + (role === 'user' ? 'user' : 'bot') +
      (isError ? ' chat-msg--error' : '');

    var bubble = document.createElement('div');
    bubble.className = 'chat-msg__bubble';
    bubble.textContent = text; // textContent — never inject model output as HTML

    wrap.appendChild(bubble);
    els.log.appendChild(wrap);
    scrollToEnd();
    return wrap;
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'chat-typing';
    el.id = 'chatTyping';
    el.setAttribute('aria-label', 'Assistant is typing');
    el.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    els.log.appendChild(el);
    scrollToEnd();
  }

  function hideTyping() {
    var el = document.getElementById('chatTyping');
    if (el) el.remove();
  }

  function scrollToEnd() {
    els.log.scrollTop = els.log.scrollHeight;
  }

  function renderSuggestions() {
    els.suggestions.innerHTML = '';
    SUGGESTIONS.forEach(function (question) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = question;
      btn.addEventListener('click', function () {
        els.suggestions.innerHTML = '';
        send(question);
      });
      els.suggestions.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------
     Open / close
     ------------------------------------------------------------------ */
  function open() {
    els.panel.classList.add('is-open');
    els.launcher.classList.add('is-hidden');

    if (!greeted) {
      greeted = true;
      addMessage('assistant', GREETING);
      renderSuggestions();
    }

    window.setTimeout(function () { els.input.focus(); }, 60);
  }

  function close() {
    els.panel.classList.remove('is-open');
    els.launcher.classList.remove('is-hidden');
    els.launcher.focus();
  }

  /* ------------------------------------------------------------------
     Sending
     ------------------------------------------------------------------ */
  function send(text) {
    var message = String(text || '').trim();
    if (!message || busy) return;

    addMessage('user', message);
    history.push({ role: 'user', content: message });

    els.input.value = '';
    setBusy(true);
    showTyping();

    ask()
      .then(function (reply) {
        hideTyping();
        addMessage('assistant', reply);
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function (err) {
        hideTyping();
        addMessage(
          'assistant',
          "Sorry — I couldn't reach the assistant just now. " +
          'For anything urgent, call or text us at (555) 555-0123 and a human will pick up. ' +
          '(' + err.message + ')',
          true
        );
        // Drop the unanswered turn so the next request has a clean history.
        history.pop();
      })
      .then(function () {
        setBusy(false);
        els.input.focus();
      });
  }

  function setBusy(state) {
    busy = state;
    els.send.disabled = state;
    els.input.disabled = state;
  }

  function ask() {
    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'YOUR_API_KEY_HERE') {
      return Promise.reject(new Error('API key not configured'));
    }

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // Required for calls made straight from a browser.
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,          // answers are short by design
        system: SYSTEM_PROMPT,
        messages: history.slice(-16) // keep the last few turns for context
      })
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (body) {
            throw new Error('HTTP ' + res.status + (body ? ': ' + body.slice(0, 140) : ''));
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (data.stop_reason === 'refusal') {
          return "I can't help with that one, but I'm happy to answer anything about our IT services.";
        }
        var text = (data.content || [])
          .filter(function (block) { return block.type === 'text'; })
          .map(function (block) { return block.text; })
          .join('\n')
          .trim();

        return text || "I didn't catch that — mind rephrasing?";
      });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    build();

    els.launcher.addEventListener('click', open);
    els.close.addEventListener('click', close);

    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
      send(els.input.value);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.panel.classList.contains('is-open')) close();
    });

    // Any element with data-open-chat opens the widget.
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest ? e.target.closest('[data-open-chat]') : null;
      if (trigger) {
        e.preventDefault();
        open();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
