/* ==========================================================================
   ItHelpExpress — automation.js
   "What Can Be Automated?" quiz on automation.html — 3 questions
   (single-choice, dropdown, multi-select) + an AI-generated recommendation.
   ========================================================================== */

/* ⚠️  REPLACE THIS WITH YOUR ANTHROPIC API KEY ⚠️
   -------------------------------------------------------------------------
   SECURITY WARNING: a key placed here is downloaded by every visitor and is
   readable in "View Source" and the browser's Network tab. Anyone can copy it
   and spend against your account.

   Fine for local testing and demos. Before you take real traffic, move these
   calls behind a serverless function (Cloudflare Pages Functions or Netlify
   Functions), keep the key in that platform's environment variables, and point
   API_ENDPOINT below at your own /api/automation route instead of
   api.anthropic.com.
   ------------------------------------------------------------------------- */
(function () {
  'use strict';

const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT =
  'You are an AI automation consultant for ItHelpExpress, a DFW IT services ' +
  "company. Based on the user's quiz answers, suggest 3 specific automations " +
  'that would save them the most time. For each one, name it, describe what ' +
  'it does in one plain sentence, and estimate hours saved per week. Then ' +
  'recommend which retainer package fits them best (Basic $99, Growth $199, ' +
  'or Pro $349) and explain why in one sentence. Be warm, specific, and ' +
  'practical. Format as JSON with fields: automations (array of name, ' +
  'description, hours_saved), recommended_package, package_reason. Reply ' +
  'with JSON only, no prose or code fences.';

  var PACKAGES = {
    Basic:  { name: 'Automation Basic',  price: '$99/mo' },
    Growth: { name: 'Automation Growth', price: '$199/mo' },
    Pro:    { name: 'Automation Pro',    price: '$349/mo' }
  };

  var QUESTIONS = [
    {
      id: 'employees',
      type: 'choice',
      label: 'employee count',
      text: 'How many employees do you have?',
      options: [
        { label: '1–5', value: '1-5' },
        { label: '6–15', value: '6-15' },
        { label: '16+', value: '16+' }
      ]
    },
    {
      id: 'timeSink',
      type: 'select',
      label: 'biggest time sink',
      text: 'What takes the most time in your week?',
      options: [
        'Client communication',
        'Employee tasks',
        'Invoicing & payments',
        'Reporting',
        'Other'
      ]
    },
    {
      id: 'tools',
      type: 'multiselect',
      label: 'tools currently used',
      text: 'Do you currently use any of these tools?',
      options: ['Google Workspace', 'Microsoft 365', 'QuickBooks', 'Shopify', 'Other', 'None']
    }
  ];

  var answers = {};
  var index = 0;
  var els = {};

  /* ------------------------------------------------------------------
     Question rendering — one function per input type
     ------------------------------------------------------------------ */
  function renderQuestion() {
    var q = QUESTIONS[index];

    els.progressBar.style.width = ((index / QUESTIONS.length) * 100) + '%';
    els.step.textContent = 'Question ' + (index + 1) + ' of ' + QUESTIONS.length;
    els.remaining.textContent = (QUESTIONS.length - index) + ' left';
    els.questionText.textContent = q.text;
    els.back.hidden = index === 0;

    els.answerArea.innerHTML = '';

    if (q.type === 'choice') renderChoice(q);
    else if (q.type === 'select') renderSelect(q);
    else if (q.type === 'multiselect') renderMultiselect(q);

    els.questionCard.focus();
  }

  function renderChoice(q) {
    var wrap = document.createElement('div');
    wrap.className = 'quiz-answers';

    q.options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      var chosen = answers[q.id] === opt.value;
      btn.className = 'btn btn--lg ' + (chosen ? 'btn--primary' : 'btn--secondary');
      btn.textContent = opt.label;
      btn.addEventListener('click', function () {
        answers[q.id] = opt.value;
        advance();
      });
      wrap.appendChild(btn);
    });

    els.answerArea.appendChild(wrap);
  }

  function renderSelect(q) {
    var wrap = document.createElement('div');
    wrap.className = 'quiz-select-row';

    var field = document.createElement('div');
    field.className = 'field';
    var select = document.createElement('select');
    select.id = 'automationSelect_' + q.id;

    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose the closest one…';
    placeholder.disabled = true;
    select.appendChild(placeholder);

    q.options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });

    select.value = answers[q.id] || '';
    if (!select.value) placeholder.selected = true;

    field.appendChild(select);
    wrap.appendChild(field);

    var row = document.createElement('div');
    row.className = 'quiz-continue-row';
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn--primary btn--lg';
    next.textContent = 'Continue';
    next.disabled = !select.value;
    row.appendChild(next);
    wrap.appendChild(row);

    select.addEventListener('change', function () {
      next.disabled = !select.value;
    });
    next.addEventListener('click', function () {
      if (!select.value) return;
      answers[q.id] = select.value;
      advance();
    });

    els.answerArea.appendChild(wrap);
  }

  function renderMultiselect(q) {
    var wrap = document.createElement('div');
    wrap.className = 'quiz-select-row';

    var group = document.createElement('div');
    group.className = 'checkbox-pill-group';

    var selected = (answers[q.id] || []).slice();

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn--primary btn--lg';
    next.textContent = 'Continue';
    next.disabled = selected.length === 0;

    q.options.forEach(function (opt) {
      var label = document.createElement('label');
      label.className = 'checkbox-pill';

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = opt;
      input.checked = selected.indexOf(opt) !== -1;

      var span = document.createElement('span');
      span.textContent = opt;

      label.appendChild(input);
      label.appendChild(span);
      group.appendChild(label);

      input.addEventListener('change', function () {
        if (opt === 'None') {
          // "None" is exclusive — picking it clears every other checkbox.
          if (input.checked) {
            selected = ['None'];
            Array.prototype.forEach.call(group.querySelectorAll('input'), function (cb) {
              if (cb !== input) cb.checked = false;
            });
          } else {
            selected = [];
          }
        } else {
          if (input.checked) {
            var noneBox = group.querySelector('input[value="None"]');
            if (noneBox) noneBox.checked = false;
            selected = selected.filter(function (v) { return v !== 'None'; });
            selected.push(opt);
          } else {
            selected = selected.filter(function (v) { return v !== opt; });
          }
        }
        next.disabled = selected.length === 0;
      });
    });

    wrap.appendChild(group);

    var row = document.createElement('div');
    row.className = 'quiz-continue-row';
    row.appendChild(next);
    wrap.appendChild(row);

    next.addEventListener('click', function () {
      if (!selected.length) return;
      answers[q.id] = selected;
      advance();
    });

    els.answerArea.appendChild(wrap);
  }

  function advance() {
    if (index < QUESTIONS.length - 1) {
      index += 1;
      renderQuestion();
    } else {
      finish();
    }
  }

  function back() {
    if (index === 0) return;
    index -= 1;
    renderQuestion();
  }

  /* ------------------------------------------------------------------
     Result
     ------------------------------------------------------------------ */
  function finish() {
    els.progressBar.style.width = '100%';
    els.step.textContent = 'All done';
    els.remaining.textContent = 'Building your recommendation';

    els.quizStage.hidden = true;
    els.resultStage.hidden = false;
    els.resultStage.focus();
    els.resultStage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    recommend()
      .then(render)
      .catch(function () { render(localRecommendation()); });
  }

  function answersText() {
    var employeeQ = QUESTIONS[0];
    var chosen = employeeQ.options.filter(function (o) { return o.value === answers.employees; })[0];
    return [
      'Employees: ' + (chosen ? chosen.label : answers.employees),
      'Biggest time sink: ' + answers.timeSink,
      'Tools currently used: ' + (answers.tools || []).join(', ')
    ].join('\n');
  }

  function recommend() {
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
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'Here are the quiz answers:\n\n' + answersText() }]
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

        var start = text.indexOf('{');
        var end = text.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('Unexpected response shape');

        var parsed = JSON.parse(text.slice(start, end + 1));
        if (!parsed.automations || !parsed.automations.length) throw new Error('No automations returned');
        return parsed;
      });
  }

  /* Deterministic backup so the quiz still gives a useful answer if the API
     call fails or no key is configured. */
  function localRecommendation() {
    var byTimeSink = {
      'Client communication': [
        { name: 'Client Welcome & Update Emails', description: 'Automatically sends a warm welcome and status updates as a client moves through your process.', hours_saved: 3 },
        { name: 'Google Review Requests', description: 'Texts or emails a review link automatically a day after each completed job.', hours_saved: 1 },
        { name: 'Lead Follow-Up Sequence', description: 'Follows up with new leads on a schedule so none go cold waiting on a reply.', hours_saved: 2 }
      ],
      'Employee tasks': [
        { name: 'Employee Onboarding Checklist', description: 'Walks every new hire through accounts, paperwork, and equipment automatically.', hours_saved: 4 },
        { name: 'Staff Shift Reminders', description: 'Texts your team their upcoming shifts so you stop fielding "what time am I in" messages.', hours_saved: 1.5 },
        { name: 'New Client Welcome Emails', description: 'Sends a consistent welcome sequence the moment a new client signs on.', hours_saved: 2 }
      ],
      'Invoicing & payments': [
        { name: 'Invoice Reminders', description: 'Automatically nudges clients with unpaid invoices on a set schedule.', hours_saved: 2.5 },
        { name: 'Payment Follow-Up Sequence', description: 'Escalates politely — email, then text — for invoices that go past due.', hours_saved: 1.5 },
        { name: 'Weekly Sales Report', description: 'Compiles the week’s numbers into one email every Monday morning.', hours_saved: 1 }
      ],
      Reporting: [
        { name: 'Weekly Sales & Inventory Report', description: 'Pulls your numbers together automatically instead of a manual spreadsheet pass.', hours_saved: 3 },
        { name: 'Low Stock Alerts', description: 'Flags items running low before they actually run out.', hours_saved: 1 },
        { name: 'Client Update Emails', description: 'Sends clients a status update on a schedule without you writing each one.', hours_saved: 1.5 }
      ],
      Other: [
        { name: 'Appointment Confirmations & Follow-Ups', description: 'Confirms bookings and follows up automatically so fewer people no-show.', hours_saved: 2 },
        { name: 'Invoice Reminders', description: 'Automatically nudges clients with unpaid invoices on a set schedule.', hours_saved: 2 },
        { name: 'Weekly Reports', description: 'Pulls together a weekly snapshot of the numbers that matter to you.', hours_saved: 1.5 }
      ]
    };

    var automations = byTimeSink[answers.timeSink] || byTimeSink.Other;

    var pkg = 'Growth';
    if (answers.employees === '1-5') pkg = 'Basic';
    else if (answers.employees === '16+') pkg = 'Pro';

    var reasons = {
      Basic: 'A small team usually has one or two repetitive tasks worth automating, and Basic keeps those running without paying for more than you need.',
      Growth: 'With your team size there’s almost always more than one task worth automating, and Growth adds a new workflow every month as you find them.',
      Pro: 'At your size, automation opportunities show up constantly — Pro gives you unlimited tweaks and a monthly strategy call to keep finding them.'
    };

    return {
      automations: automations,
      recommended_package: pkg,
      package_reason: reasons[pkg]
    };
  }

  function matchPackage(raw) {
    var s = String(raw || '');
    if (/basic/i.test(s)) return 'Basic';
    if (/pro/i.test(s)) return 'Pro';
    return 'Growth'; // default — also covers an unrecognized/missing value
  }

  function hoursLabel(h) {
    var s = String(h == null ? '' : h).trim();
    if (!s) return 'Saves time';
    if (/^\d+(\.\d+)?$/.test(s)) return '~' + s + ' hrs/week saved';
    if (/hour|hr/i.test(s)) return s;
    return s + ' saved';
  }

  function render(result) {
    var pkgKey = matchPackage(result.recommended_package);
    var pkg = PACKAGES[pkgKey];

    els.resultLoading.hidden = true;
    els.resultContent.hidden = false;

    els.automationGrid.innerHTML = '';
    (result.automations || []).slice(0, 3).forEach(function (a) {
      var card = document.createElement('div');
      card.className = 'automation-result-card';

      var h4 = document.createElement('h4');
      h4.textContent = a.name || 'Automation';

      var p = document.createElement('p');
      p.textContent = a.description || '';

      var badge = document.createElement('span');
      badge.className = 'hours-badge';
      badge.textContent = '⏱ ' + hoursLabel(a.hours_saved);

      card.appendChild(h4);
      card.appendChild(p);
      card.appendChild(badge);
      els.automationGrid.appendChild(card);
    });

    els.resultPlanName.textContent = pkg.name;
    els.resultPlanPrice.textContent = pkg.price;
    els.resultReason.textContent = result.package_reason || '';

    els.resultCta.href = 'contact.html?topic=automation-audit&package=' + encodeURIComponent(pkgKey);
  }

  function restart() {
    answers = {};
    index = 0;
    els.resultStage.hidden = true;
    els.resultContent.hidden = true;
    els.resultLoading.hidden = false;
    els.quizStage.hidden = false;
    renderQuestion();
    els.quizStage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function init() {
    els.quizStage = document.getElementById('automationQuizStage');
    if (!els.quizStage) return;

    els.resultStage = document.getElementById('automationResultStage');
    els.questionCard = document.getElementById('automationQuestionCard');
    els.questionText = document.getElementById('automationQuestionText');
    els.answerArea = document.getElementById('automationAnswerArea');
    els.back = document.getElementById('automationQuizBack');
    els.progressBar = document.getElementById('automationProgressBar');
    els.step = document.getElementById('automationQuizStep');
    els.remaining = document.getElementById('automationQuizRemaining');

    els.resultLoading = document.getElementById('automationResultLoading');
    els.resultContent = document.getElementById('automationResultContent');
    els.automationGrid = document.getElementById('automationResultGrid');
    els.resultPlanName = document.getElementById('automationPlanName');
    els.resultPlanPrice = document.getElementById('automationPlanPrice');
    els.resultReason = document.getElementById('automationReason');
    els.resultCta = document.getElementById('automationResultCta');

    els.back.addEventListener('click', back);

    var restartBtn = document.getElementById('automationQuizRestart');
    if (restartBtn) restartBtn.addEventListener('click', restart);

    renderQuestion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
