/* ==========================================================================
   ItHelpExpress — assessment.js
   Free IT Health Check: 6 yes/no questions + an AI plan recommendation.
   ========================================================================== */

/* ⚠️  REPLACE THIS WITH YOUR ANTHROPIC API KEY ⚠️
   -------------------------------------------------------------------------
   SECURITY WARNING: a key placed here is downloaded by every visitor and is
   readable in "View Source" and the browser's Network tab. Anyone can copy it
   and spend against your account.

   Fine for local testing and demos. Before you take real traffic, move these
   calls behind a serverless function (Cloudflare Pages Functions or Netlify
   Functions), keep the key in that platform's environment variables, and point
   API_ENDPOINT below at your own /api/assess route instead of api.anthropic.com.
   ------------------------------------------------------------------------- */
/* Scoped so that pages loading more than one of these files (this page loads
   assessment.js and chat.js together) don't collide on the name. */
(function () {
  'use strict';

const ANTHROPIC_API_KEY = 'YOUR_API_KEY_HERE';

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

const ADVISOR_PROMPT =
  'You are an IT advisor for ItHelpExpress. Based on the quiz answers, ' +
  'recommend the best plan (Starter $99, Business $249, or Growth $449) and ' +
  'explain why in 2–3 friendly sentences. Then list 1–2 add-ons that would ' +
  'help them specifically. Be warm and practical.\n\n' +
  'Available add-ons: Extra device (+$10/device/mo), Additional on-site visit ' +
  '($99 each), AI automation workflow ($149 one-time each), Priority 2-hour ' +
  'response upgrade (+$49/mo), Employee tech onboarding ($79/new hire), ' +
  'Security & antivirus (+$29/mo), Cloud backup monitoring (+$39/mo), ' +
  'Smart office / camera setup ($199 one-time).\n\n' +
  'Reply with JSON only, no prose or code fences, in exactly this shape:\n' +
  '{"plan":"Starter|Business|Growth","reason":"2-3 friendly sentences",' +
  '"addons":[{"name":"...","why":"one short sentence"}]}';

const QUESTIONS = [
  {
    id: 'devices',
    text: 'Do you have more than 3 computers or devices?',
    ask: 'Has more than 3 computers or devices'
  },
  {
    id: 'outage',
    text: 'Have you experienced a tech outage in the last 6 months?',
    ask: 'Had a tech outage in the last 6 months'
  },
  {
    id: 'managed',
    text: 'Do you currently have anyone managing your IT?',
    ask: 'Currently has someone managing their IT'
  },
  {
    id: 'backups',
    text: 'Do you have cloud backups set up?',
    ask: 'Has cloud backups set up'
  },
  {
    id: 'lostTime',
    text: 'Do employees lose time to tech issues weekly?',
    ask: 'Employees lose time to tech issues weekly'
  },
  {
    id: 'automation',
    text: 'Are you interested in automating any business tasks?',
    ask: 'Interested in automating business tasks'
  }
];

const PLANS = {
  Starter:  { price: '$99/mo',  blurb: 'Up to 3 devices · next-day response' },
  Business: { price: '$249/mo', blurb: 'Up to 10 devices · same-day response · 1 on-site visit/mo' },
  Growth:   { price: '$449/mo', blurb: 'Up to 20 devices · 2-hour response · 2 on-site visits/mo' }
};

  var answers = {};
  var index = 0;
  var els = {};

  /* ------------------------------------------------------------------
     Question flow
     ------------------------------------------------------------------ */
  function renderQuestion() {
    var q = QUESTIONS[index];

    els.progressBar.style.width = ((index / QUESTIONS.length) * 100) + '%';
    els.step.textContent = 'Question ' + (index + 1) + ' of ' + QUESTIONS.length;
    els.remaining.textContent = (QUESTIONS.length - index) + ' left';

    els.questionText.textContent = q.text;
    els.back.hidden = index === 0;

    // Reflect a previously given answer if they stepped back.
    Array.prototype.forEach.call(els.answerButtons, function (btn) {
      var value = btn.getAttribute('data-answer') === 'yes';
      var chosen = answers[q.id];
      var isChosen = chosen !== undefined && chosen === value;
      btn.classList.toggle('btn--primary', isChosen);
      btn.classList.toggle('btn--secondary', !isChosen);
    });

    els.questionCard.focus();
  }

  function answer(value) {
    answers[QUESTIONS[index].id] = value;

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
     Results
     ------------------------------------------------------------------ */
  function finish() {
    els.progressBar.style.width = '100%';
    els.step.textContent = 'All done';
    els.remaining.textContent = 'Building your result';

    els.quizStage.hidden = true;
    els.resultStage.hidden = false;
    els.resultStage.focus();
    els.resultStage.scrollIntoView({ behavior: 'smooth', block: 'center' });

    recommend()
      .then(render)
      .catch(function () { render(localRecommendation()); });
  }

  function answersText() {
    return QUESTIONS.map(function (q) {
      return '- ' + q.ask + ': ' + (answers[q.id] ? 'Yes' : 'No');
    }).join('\n');
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
        system: ADVISOR_PROMPT,
        messages: [{
          role: 'user',
          content: 'Here are the quiz answers:\n\n' + answersText()
        }]
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
        if (!PLANS[parsed.plan]) throw new Error('Unknown plan: ' + parsed.plan);
        return parsed;
      });
  }

  /* Deterministic backup so the quiz still gives a real answer if the API
     call fails or no key is configured. */
  function localRecommendation() {
    var score = 0;
    if (answers.devices) score += 2;
    if (answers.outage) score += 1;
    if (!answers.managed) score += 1;
    if (!answers.backups) score += 1;
    if (answers.lostTime) score += 2;
    if (answers.automation) score += 1;

    var plan = score >= 6 ? 'Growth' : (score >= 3 ? 'Business' : 'Starter');

    var reason;
    if (plan === 'Growth') {
      reason = 'You have got enough devices and enough weekly friction that ad-hoc ' +
        'help will keep costing you more than a plan does. Growth gives you a ' +
        'two-hour response window and two on-site visits a month, so problems ' +
        'get handled before they eat a whole afternoon.';
    } else if (plan === 'Business') {
      reason = 'You are past the point where one person can keep everything running ' +
        'on the side. Business covers up to 10 devices with same-day response and ' +
        'a monthly on-site visit — enough to stay ahead of the small stuff.';
    } else {
      reason = 'Your setup is small and reasonably steady, so you do not need to ' +
        'overbuy. Starter covers up to 3 devices with next-day response and ' +
        'monitoring, and you can move up whenever you grow.';
    }

    var addons = [];
    if (!answers.backups) {
      addons.push({
        name: 'Cloud backup monitoring (+$39/mo)',
        why: 'Without backups, one failed drive can take your business records with it.'
      });
    }
    if (answers.automation) {
      addons.push({
        name: 'AI automation workflow ($149 one-time)',
        why: 'We build one workflow that takes a recurring manual task off your plate for good.'
      });
    }
    if (addons.length < 2 && answers.outage) {
      addons.push({
        name: 'Priority 2-hour response upgrade (+$49/mo)',
        why: 'After an outage, the difference between two hours and next day is real money.'
      });
    }
    if (!addons.length) {
      addons.push({
        name: 'Security & antivirus (+$29/mo)',
        why: 'Cheapest insurance there is against the problem that ruins a week.'
      });
    }

    return { plan: plan, reason: reason, addons: addons.slice(0, 2) };
  }

  function render(result) {
    var plan = PLANS[result.plan] || PLANS.Business;

    els.resultLoading.hidden = true;
    els.resultContent.hidden = false;

    els.resultPlanName.textContent = result.plan;
    els.resultPlanPrice.textContent = plan.price;
    els.resultPlanBlurb.textContent = plan.blurb;

    els.resultReason.textContent = result.reason || '';

    els.resultAddons.innerHTML = '';
    (result.addons || []).slice(0, 2).forEach(function (addon) {
      var li = document.createElement('li');

      // The li is a flex row (marker + content), so the name and the
      // explanation go in one wrapper to keep them flowing as a sentence.
      var body = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = addon.name;
      body.appendChild(strong);
      if (addon.why) body.appendChild(document.createTextNode(' — ' + addon.why));

      li.appendChild(body);
      els.resultAddons.appendChild(li);
    });
    els.resultAddonsWrap.hidden = !(result.addons && result.addons.length);

    els.resultCta.textContent = 'Get Started with ' + result.plan;
    els.resultCta.href = 'contact.html?plan=' + encodeURIComponent(result.plan);
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
    els.quizStage = document.getElementById('quizStage');
    if (!els.quizStage) return;

    els.resultStage = document.getElementById('resultStage');
    els.questionCard = document.getElementById('questionCard');
    els.questionText = document.getElementById('questionText');
    els.answerButtons = document.querySelectorAll('[data-answer]');
    els.back = document.getElementById('quizBack');
    els.progressBar = document.getElementById('quizProgressBar');
    els.step = document.getElementById('quizStep');
    els.remaining = document.getElementById('quizRemaining');

    els.resultLoading = document.getElementById('resultLoading');
    els.resultContent = document.getElementById('resultContent');
    els.resultPlanName = document.getElementById('resultPlanName');
    els.resultPlanPrice = document.getElementById('resultPlanPrice');
    els.resultPlanBlurb = document.getElementById('resultPlanBlurb');
    els.resultReason = document.getElementById('resultReason');
    els.resultAddons = document.getElementById('resultAddons');
    els.resultAddonsWrap = document.getElementById('resultAddonsWrap');
    els.resultCta = document.getElementById('resultCta');

    Array.prototype.forEach.call(els.answerButtons, function (btn) {
      btn.addEventListener('click', function () {
        answer(btn.getAttribute('data-answer') === 'yes');
      });
    });

    els.back.addEventListener('click', back);

    var restartBtn = document.getElementById('quizRestart');
    if (restartBtn) restartBtn.addEventListener('click', restart);

    renderQuestion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
