/* ─── STATE ─── */
let selectedFile    = null;
let jobGoalText     = '';
let currentFeedback = null;
let recognition     = null;
let isRecording     = false;
let loadingTimers   = [];
let loadingMsgInterval = null;

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://careerlens-ai-production-817d.up.railway.app';
const RING_C   = 364.42; // 2π × 58

/* ─── DOM REFS ─── */
const uploadZone    = document.getElementById('uploadZone');
const cvFileInput   = document.getElementById('cvFile');
const dropIdle      = document.getElementById('dropIdle');
const dropDone      = document.getElementById('dropDone');
const chipName      = document.getElementById('chipName');
const chipSize      = document.getElementById('chipSize');
const removeFile    = document.getElementById('removeFile');

const micBtn        = document.getElementById('micBtn');
const micStop       = document.getElementById('micStop');
const reRecordBtn   = document.getElementById('reRecordBtn');
const recInterim    = document.getElementById('recInterim');
const tcText        = document.getElementById('tcText');

const jobGoalInput  = document.getElementById('jobGoalInput');
const jdInput       = document.getElementById('jdInput');
const userEmailInput = document.getElementById('userEmail');
const analyzeBtn    = document.getElementById('analyzeBtn');
const ctaLabel      = document.getElementById('ctaLabel');
const ctaArrow      = document.getElementById('ctaArrow');
const ctaSub        = document.getElementById('ctaSub');

const errBanner     = document.getElementById('errBanner');
const errText       = document.getElementById('errText');
const errClose      = document.getElementById('errClose');

const loadingOverlay = document.getElementById('loadingOverlay');
const ovBar         = document.getElementById('ovBar');
const ovHeadline    = document.getElementById('ovHeadline');

const resultsEl     = document.getElementById('results');
const scoreRingFill = document.getElementById('scoreRingFill');
const scoreNumber   = document.getElementById('scoreNumber');
const scoreTag      = document.getElementById('scoreTag');
const scoreExplanation = document.getElementById('scoreExplanation');
const motivationalMessage = document.getElementById('motivationalMessage');
const strengthsList = document.getElementById('strengthsList');
const skillGapsList = document.getElementById('skillGapsList');
const cvImprovementsList = document.getElementById('cvImprovementsList');
const nextStepsList = document.getElementById('nextStepsList');
const interviewQuestionsList = document.getElementById('interviewQuestionsList');
const resourcesList = document.getElementById('resourcesList');
const jdMatchSection = document.getElementById('jdMatchSection');

const ttsBtn     = document.getElementById('ttsBtn');
const copyBtn    = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn   = document.getElementById('resetBtn');

/* ─── STEPPER ─── */
function setStep(n) {
  [1, 2, 3, 4].forEach(i => {
    const el = document.getElementById(`si-${i}`);
    el.classList.remove('active', 'done');
    if (i < n)  el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
  document.querySelectorAll('.stepper-track').forEach((t, i) => {
    t.classList.toggle('done', i + 1 < n);
  });
}

/* ─── STEP COLLAPSE / EXPAND ─── */
function collapseFcard(n, summaryText) {
  const card    = document.getElementById(`fcard-${n}`);
  const summary = document.getElementById(`fcard-${n}-summary`);
  if (!card) return;
  card.classList.add('collapsed');
  if (summary) {
    summary.textContent = summaryText;
    summary.classList.remove('hidden');
  }
}

function expandFcard(n) {
  const card    = document.getElementById(`fcard-${n}`);
  const summary = document.getElementById(`fcard-${n}-summary`);
  if (!card) return;
  card.classList.remove('collapsed');
  if (summary) summary.classList.add('hidden');
}

// Click-to-expand on collapsed cards
document.querySelectorAll('.fcard').forEach(card => {
  card.addEventListener('click', () => {
    if (card.classList.contains('collapsed')) {
      const n = card.id.replace('fcard-', '');
      expandFcard(n);
    }
  });
});

/* ─── FILE UPLOAD ─── */
cvFileInput.addEventListener('change', e => handleFileSelect(e.target.files[0]));

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
});

removeFile.addEventListener('click', e => {
  e.stopPropagation();
  clearFile();
});

function handleFileSelect(file) {
  if (!file) return;
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    showError('Invalid file type. Please upload a JPG, PNG, WEBP, PDF, or DOCX.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) { showError('File too large. Maximum size is 10 MB.'); return; }

  hideError();
  selectedFile = file;
  chipName.textContent = file.name;
  chipSize.textContent = fmtBytes(file.size);
  dropIdle.classList.add('hidden');
  dropDone.classList.remove('hidden');
  document.getElementById('status-1').textContent = '✓';
  document.getElementById('status-1').className = 'fcard-status done';
  if (jobGoalText) setStep(4); else setStep(2);
  updateCTA();

  // Collapse step 1 and scroll to step 2
  setTimeout(() => {
    collapseFcard(1, `📄 ${file.name}  ·  ${fmtBytes(file.size)}`);
    if (!jobGoalText) {
      setTimeout(() => {
        document.getElementById('fcard-2').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    }
  }, 300);
}

function clearFile() {
  selectedFile = null;
  cvFileInput.value = '';
  dropIdle.classList.remove('hidden');
  dropDone.classList.add('hidden');
  document.getElementById('status-1').textContent = '';
  document.getElementById('status-1').className = 'fcard-status';
  expandFcard(1);
  setStep(1);
  updateCTA();
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

/* ─── VOICE STATE MACHINE ─── */
function setVoiceState(state) {
  ['vs-idle','vs-recording','vs-done','vs-unsupported'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(`vs-${state}`).classList.remove('hidden');
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  setVoiceState('unsupported');
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecording = true;
    setVoiceState('recording');
    recInterim.textContent = '';
  };

  recognition.onresult = e => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      e.results[i].isFinal ? (final += t) : (interim += t);
    }
    recInterim.textContent = final || interim;
    if (final) {
      jobGoalText = final.trim();
      jobGoalInput.value = jobGoalText;
      updateGoalDone();
    }
  };

  recognition.onend = () => {
    isRecording = false;
    if (jobGoalText) {
      tcText.textContent = jobGoalText;
      setVoiceState('done');
    } else {
      setVoiceState('idle');
    }
  };

  recognition.onerror = e => {
    console.error('Speech error:', e.error);
    isRecording = false;
    setVoiceState('idle');
    if (e.error !== 'no-speech') showError('Could not capture audio. Please try again or type your goal below.');
  };

  micBtn.addEventListener('click', () => {
    try { recognition.start(); } catch(e) { console.error(e); }
  });

  micStop.addEventListener('click', () => recognition.stop());

  reRecordBtn.addEventListener('click', () => {
    jobGoalText = '';
    jobGoalInput.value = '';
    expandFcard(2);
    setVoiceState('idle');
    document.getElementById('status-2').textContent = '';
    document.getElementById('status-2').className = 'fcard-status';
    updateCTA();
    try { recognition.start(); } catch(e) { console.error(e); }
  });
}

/* ─── TEXT FALLBACK ─── */
jobGoalInput.addEventListener('input', () => {
  jobGoalText = jobGoalInput.value.trim();
  if (jobGoalText) {
    tcText.textContent = jobGoalText;
    setVoiceState('done');
    // Update status/step without collapsing — user is still typing
    document.getElementById('status-2').textContent = '✓';
    document.getElementById('status-2').className = 'fcard-status done';
    if (selectedFile) setStep(4); else setStep(3);
  } else {
    setVoiceState('idle');
    document.getElementById('status-2').textContent = '';
    document.getElementById('status-2').className = 'fcard-status';
  }
  updateCTA();
});

// Collapse fcard-2 only when the user leaves the textarea
jobGoalInput.addEventListener('blur', () => {
  if (jobGoalText) {
    const preview = jobGoalText.length > 72 ? jobGoalText.substring(0, 72) + '…' : jobGoalText;
    collapseFcard(2, `🎯 ${preview}`);
  }
});

function updateGoalDone() {
  document.getElementById('status-2').textContent = '✓';
  document.getElementById('status-2').className = 'fcard-status done';
  if (selectedFile) setStep(4); else setStep(3);
  updateCTA();

  // Collapse only for voice input (user is not inside the textarea)
  if (document.activeElement !== jobGoalInput) {
    setTimeout(() => {
      const preview = jobGoalText.length > 72 ? jobGoalText.substring(0, 72) + '…' : jobGoalText;
      collapseFcard(2, `🎯 ${preview}`);
    }, 400);
  }
}

/* ─── JD INPUT ─── */
jdInput.addEventListener('input', () => {
  const hasJD = jdInput.value.trim().length > 0;
  document.getElementById('status-3').textContent = hasJD ? '✓' : '';
  document.getElementById('status-3').className = hasJD ? 'fcard-status done' : 'fcard-status';
});

/* ─── CTA STATE ─── */
function updateCTA() {
  const ready = selectedFile && jobGoalText;
  analyzeBtn.disabled = !ready;
  if (!selectedFile && !jobGoalText) {
    ctaSub.textContent = 'Upload your CV and describe your goal to continue';
  } else if (!selectedFile) {
    ctaSub.textContent = 'Upload your CV to continue';
  } else if (!jobGoalText) {
    ctaSub.textContent = 'Now describe your target role above';
  } else {
    const hasJD = jdInput.value.trim().length > 0;
    ctaSub.textContent = hasJD
      ? 'You\'re all set — ATS match analysis included'
      : 'You\'re all set — takes about 15–20 seconds';
  }
}

/* ─── ERROR ─── */
errClose.addEventListener('click', hideError);
function showError(msg) { errText.textContent = msg; errBanner.classList.remove('hidden'); }
function hideError() { errBanner.classList.add('hidden'); }

/* ─── CYCLING AI LOADING MESSAGES ─── */
const AI_MESSAGES = [
  'Analyzing your career profile…',
  'Extracting your CV details…',
  'Cross-referencing 2025 market data…',
  'Identifying skill gaps…',
  'Calculating ATS keyword match…',
  'Writing your personalized coaching…',
  'Finalizing career roadmap…',
];

/* ─── LOADING OVERLAY ─── */
function showLoading() {
  loadingOverlay.classList.remove('hidden');
  ['ovs-1','ovs-2','ovs-3'].forEach(id => {
    document.getElementById(id).className = 'ov-step';
  });
  ovBar.style.width = '0%';

  // Reset headline
  if (ovHeadline) ovHeadline.textContent = AI_MESSAGES[0];

  document.getElementById('ovs-1').classList.add('active');
  requestAnimationFrame(() => { ovBar.style.width = '20%'; });

  // Cycle headline messages
  let msgIdx = 0;
  loadingMsgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % AI_MESSAGES.length;
    if (ovHeadline) {
      ovHeadline.style.opacity = '0';
      setTimeout(() => {
        if (ovHeadline) {
          ovHeadline.textContent = AI_MESSAGES[msgIdx];
          ovHeadline.style.opacity = '1';
        }
      }, 200);
    }
  }, 2200);

  const t1 = setTimeout(() => {
    document.getElementById('ovs-1').classList.replace('active','done');
    document.getElementById('ovs-2').classList.add('active');
    ovBar.style.width = '55%';
  }, 2000);
  const t2 = setTimeout(() => {
    document.getElementById('ovs-2').classList.replace('active','done');
    document.getElementById('ovs-3').classList.add('active');
    ovBar.style.width = '82%';
  }, 4500);
  loadingTimers.push(t1, t2);
}

function hideLoading() {
  loadingTimers.forEach(clearTimeout);
  loadingTimers = [];
  if (loadingMsgInterval) {
    clearInterval(loadingMsgInterval);
    loadingMsgInterval = null;
  }
  ovBar.style.width = '100%';
  setTimeout(() => { loadingOverlay.classList.add('hidden'); }, 350);
}

/* ─── ANALYZE ─── */
analyzeBtn.addEventListener('click', analyzeCareer);

async function analyzeCareer() {
  hideError();
  if (!selectedFile || !jobGoalText) return;

  resultsEl.classList.add('hidden');
  window.speechSynthesis && window.speechSynthesis.cancel();
  setCtaLoading(true);
  showLoading();

  const fd = new FormData();
  fd.append('cv_image', selectedFile);
  fd.append('job_goal', jobGoalText);
  fd.append('user_email', userEmailInput.value.trim());
  fd.append('job_description', jdInput.value.trim());

  try {
    const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `Server error ${res.status}`);
    currentFeedback = data;
    hideLoading();
    renderResults(data);
  } catch (err) {
    hideLoading();
    showError(
      err.message.includes('Failed to fetch')
        ? 'Cannot reach the backend. Make sure uvicorn is running on http://localhost:8000'
        : err.message
    );
  } finally {
    setCtaLoading(false);
  }
}

function setCtaLoading(on) {
  if (on) {
    ctaLabel.innerHTML = '<span class="spinner"></span> Analyzing…';
    analyzeBtn.disabled = true;
    ctaArrow.classList.add('hidden');
  } else {
    ctaLabel.textContent = 'Generate My Career Report';
    ctaArrow.classList.remove('hidden');
    updateCTA();
  }
}

/* ─── SAMPLE REPORT ─── */
const SAMPLE_FEEDBACK = {
  overall_score: 7,
  score_explanation: 'Strong technical foundation in software engineering, but the CV lacks PM-specific evidence such as metrics-driven product decisions and stakeholder management examples. The transition narrative is unclear to a recruiter who receives 300+ CVs per role.',
  strengths: [
    'Solid engineering background demonstrates technical credibility with product teams',
    'Led a cross-functional project delivering a 40% reduction in API latency',
    'Computer Science degree provides strong analytical and systems-thinking foundation',
    'Contributed to agile ceremonies — sprint planning, retrospectives, backlog grooming',
    'Side project shows initiative: built a habit-tracking app with 200+ active users',
  ],
  skill_gaps: [
    'No evidence of defining product vision, OKRs, or product strategy',
    'Missing user research or discovery work — interviews, surveys, usability testing',
    'No A/B testing or data-driven feature decision examples',
    'Stakeholder management and executive communication not demonstrated',
    'No product metrics or KPIs tracked or owned on current CV',
  ],
  cv_improvements: [
    'Add a professional summary: "Software Engineer transitioning to PM — 4 years of technical leadership and user-facing product delivery"',
    'Reframe engineering bullet points to highlight user impact, not implementation details',
    'Create a "Product Work" section: document your side project with metrics (MAU, retention, NPS)',
    'Quantify every bullet: "Improved API performance" → "Reduced p95 latency from 800ms to 120ms, improving checkout conversion by 8%"',
    'Add a Skills section: Product Thinking · Agile/Scrum · JIRA · Figma (basic) · SQL · A/B Testing',
  ],
  next_steps: [
    'Enroll in the Google Project Management Certificate on Coursera this week (6 hours) — it gives you PM vocabulary for interviews',
    'Document your habit app as a case study: problem → research → decisions → metrics. Add it to a personal site or Notion',
    'Apply to 3 APM or Associate PM roles at companies with internal mobility programs where your engineering background is valued',
  ],
  interview_questions: [
    'Tell me about a time you had to say no to a feature request. How did you handle it?',
    'Walk me through how you would prioritize a backlog with 40 items and limited engineering capacity.',
    'How would you measure the success of a new onboarding flow?',
  ],
  recommended_resources: [
    'Coursera — Google Project Management Certificate: structured PM fundamentals that close your process and vocabulary gaps',
    'LinkedIn Learning — Become a Product Manager: covers roadmapping, stakeholder management, and metrics',
    'Udemy — Become a Product Manager by Cole Mercer: practitioner-taught, closes the gap between engineering and product thinking',
    'YouTube — Lenny Rachitsky channel: real interviews with PMs at top companies on strategy and prioritization',
    'Official JIRA documentation — free, closes your tool knowledge gap immediately and adds a credible CV line',
  ],
  motivational_message: 'Your engineering depth is a genuine superpower in product — companies like Stripe, Notion, and Linear actively seek engineers who can lead products. This report shows you exactly what to bridge.',
};

document.getElementById('sampleReportBtn')?.addEventListener('click', () => {
  currentFeedback = SAMPLE_FEEDBACK;
  renderResults(SAMPLE_FEEDBACK);
  setTimeout(() => {
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
});

/* ─── RENDER RESULTS ─── */
const SCORE_MAP = [
  { min: 9, label: 'Exceptional',           cls: 'tag-excellent',  color: '#22c55e' },
  { min: 7, label: 'Strong Profile',         cls: 'tag-strong',     color: '#22c55e' },
  { min: 5, label: 'Good Foundation',        cls: 'tag-good',       color: '#f59e0b' },
  { min: 3, label: 'Needs Development',      cls: 'tag-developing', color: '#fb923c' },
  { min: 0, label: 'Significant Work Needed',cls: 'tag-needs-work', color: '#ef4444' },
];

function getScoreMeta(score) {
  return SCORE_MAP.find(m => score >= m.min) || SCORE_MAP[SCORE_MAP.length - 1];
}

function renderResults(data) {
  const score = Number(data.overall_score) || 0;
  const meta  = getScoreMeta(score);

  scoreRingFill.style.stroke = meta.color;
  scoreNumber.style.color    = meta.color;
  scoreTag.className = `score-tag ${meta.cls}`;
  scoreTag.textContent = meta.label;

  animateRing(score);
  scoreNumber.textContent     = score;
  scoreExplanation.textContent = data.score_explanation || '';
  motivationalMessage.textContent = data.motivational_message || '';

  populateList(strengthsList, data.strengths);
  populateList(skillGapsList, data.skill_gaps);
  populateList(cvImprovementsList, data.cv_improvements);
  renderActionPlan(data.next_steps);
  renderInterviewQuestions(data.interview_questions);
  renderResources(data.recommended_resources);
  renderJDMatch(data.jd_match);

  resultsEl.classList.remove('hidden');
  setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function animateRing(score) {
  const target = RING_C - (score / 10) * RING_C;
  scoreRingFill.style.strokeDashoffset = RING_C;
  const t0 = performance.now();
  const dur = 1400;
  function frame(now) {
    const p = Math.min((now - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    scoreRingFill.style.strokeDashoffset = RING_C - e * (RING_C - target);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function populateList(ul, items) {
  ul.innerHTML = '';
  (items || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
}

function renderActionPlan(steps) {
  nextStepsList.innerHTML = '';
  (steps || []).forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'ap-step';
    div.innerHTML = `<div class="ap-num">${i + 1}</div><div class="ap-text">${step}</div>`;
    nextStepsList.appendChild(div);
  });
}

function renderInterviewQuestions(questions) {
  interviewQuestionsList.innerHTML = '';
  (questions || []).forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'iq-item';
    div.innerHTML = `<div class="iq-num">Q${i + 1}</div><div class="iq-text">${q}</div>`;
    interviewQuestionsList.appendChild(div);
  });
}

function renderResources(resources) {
  resourcesList.innerHTML = '';
  (resources || []).forEach((r, i) => {
    const parts = r.split(' — ');
    const name = parts[0] || r;
    const why  = parts.slice(1).join(' — ') || '';
    const div = document.createElement('div');
    div.className = 'resource-item';
    div.innerHTML = `
      <div class="resource-num">${i + 1}</div>
      <div class="resource-text">
        <div class="resource-name">${name}</div>
        ${why ? `<div class="resource-why">${why}</div>` : ''}
      </div>`;
    resourcesList.appendChild(div);
  });
}

function renderJDMatch(jdMatch) {
  if (!jdMatch || jdMatch.match_score == null) {
    jdMatchSection.classList.add('hidden');
    return;
  }

  jdMatchSection.classList.remove('hidden');

  const pct = Math.round(jdMatch.match_score);
  document.getElementById('jdMatchPct').textContent = pct + '%';

  const bar = document.getElementById('jdMatchBar');
  bar.style.width = '0%';
  const verdict = jdMatch.ats_verdict || '';
  const verdictEl = document.getElementById('jdVerdict');
  verdictEl.textContent = verdict;
  verdictEl.className = 'jdm-verdict';
  if (verdict.includes('Strong')) verdictEl.classList.add('verdict-strong');
  else if (verdict.includes('Moderate')) verdictEl.classList.add('verdict-moderate');
  else verdictEl.classList.add('verdict-weak');

  const barColor = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444';
  bar.style.background = barColor;
  setTimeout(() => { bar.style.width = pct + '%'; }, 100);

  const matchedEl = document.getElementById('matchedKeywords');
  matchedEl.innerHTML = '';
  (jdMatch.matched_keywords || []).forEach(kw => {
    const chip = document.createElement('span');
    chip.className = 'kw-chip kw-matched';
    chip.textContent = kw;
    matchedEl.appendChild(chip);
  });

  const missingEl = document.getElementById('missingKeywords');
  missingEl.innerHTML = '';
  (jdMatch.missing_keywords || []).forEach(kw => {
    const chip = document.createElement('span');
    chip.className = 'kw-chip kw-missing';
    chip.textContent = kw;
    missingEl.appendChild(chip);
  });

  const adviceEl = document.getElementById('jdAdviceList');
  adviceEl.innerHTML = '';
  (jdMatch.jd_advice || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    adviceEl.appendChild(li);
  });
}

/* ─── TTS ─── */
ttsBtn.addEventListener('click', () => { if (currentFeedback) speakFeedback(currentFeedback); });

function speakFeedback(f) {
  window.speechSynthesis.cancel();
  const script =
    `Your career score is ${f.overall_score} out of 10. ${f.score_explanation || ''} ` +
    `Your key strengths are: ${(f.strengths||[]).slice(0,3).join(', ')}. ` +
    `You should work on: ${(f.skill_gaps||[]).slice(0,3).join(', ')}. ${f.motivational_message||''}`;
  const utt = new SpeechSynthesisUtterance(script);
  utt.rate = 0.9; utt.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const fv = voices.find(v =>
    (v.name.includes('Samantha') || v.name.includes('Google UK English Female') ||
     v.name.includes('Microsoft Zira') || v.name.includes('Karen')) && v.lang.startsWith('en'));
  if (fv) utt.voice = fv;
  window.speechSynthesis.speak(utt);
}

/* ─── COPY ─── */
copyBtn.addEventListener('click', async () => {
  if (!currentFeedback) return;
  const f = currentFeedback;
  const txt = [
    'Kairix AI — Career Intelligence Report',
    '========================================',
    '',
    `Overall Score: ${f.overall_score}/10`,
    f.score_explanation || '',
    '',
    'STRENGTHS:',
    ...(f.strengths||[]).map(s=>`  • ${s}`),
    '',
    'SKILL GAPS:',
    ...(f.skill_gaps||[]).map(s=>`  • ${s}`),
    '',
    'CV IMPROVEMENTS:',
    ...(f.cv_improvements||[]).map(s=>`  • ${s}`),
    '',
    'ACTION PLAN:',
    ...(f.next_steps||[]).map((s,i)=>`  ${i+1}. ${s}`),
    '',
    'INTERVIEW QUESTIONS:',
    ...(f.interview_questions||[]).map((q,i)=>`  Q${i+1}. ${q}`),
    '',
    'RECOMMENDED RESOURCES:',
    ...(f.recommended_resources||[]).map(r=>`  • ${r}`),
    '',
    `"${f.motivational_message||''}"`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(txt);
    const orig = copyBtn.textContent;
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = orig; }, 2000);
  } catch { showError('Could not copy — please copy manually.'); }
});

/* ─── PDF DOWNLOAD ─── */
downloadBtn.addEventListener('click', () => {
  if (!currentFeedback) return;
  const f = currentFeedback;

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ unit: 'pt', format: 'a4' });
  const W    = doc.internal.pageSize.getWidth();
  const H    = doc.internal.pageSize.getHeight();
  const ML   = 44;               // left margin
  const MR   = 44;               // right margin
  const CW   = W - ML - MR;     // content width
  const LH   = 14;               // base line height
  let y      = ML;
  let pageNum = 1;

  // Strip non-ASCII to prevent jsPDF char-spacing bugs
  const clean = s => (s || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();

  const score = Number(f.overall_score) || 0;
  const scoreRgb = score >= 7 ? [34,197,94] : score >= 5 ? [245,158,11] : [239,68,68];

  /* ── helpers ── */
  function txt(str, opts = {}) {
    const { size = 9.5, style = 'normal', color = [60,70,90], x = ML, maxW = CW } = opts;
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    doc.setCharSpace(0);
    const lines = doc.splitTextToSize(clean(str), maxW);
    lines.forEach(line => {
      checkPage(LH + 2);
      doc.text(line, x, y);
      y += LH;
    });
    return lines.length;
  }

  function checkPage(need = 20) {
    if (y + need > H - 40) {
      drawFooter();
      doc.addPage();
      pageNum++;
      y = ML;
    }
  }

  function drawFooter() {
    doc.setDrawColor(210, 215, 230);
    doc.setLineWidth(0.5);
    doc.line(ML, H - 32, W - MR, H - 32);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 165, 185);
    doc.setCharSpace(0);
    doc.text('Kairix AI — Career Intelligence Report', ML, H - 20);
    doc.text(`Page ${pageNum}`, W - MR, H - 20, { align: 'right' });
  }

  function sectionHeader(title, rgb) {
    checkPage(36);
    y += 10;
    doc.setFillColor(...rgb);
    doc.rect(ML, y - 2, 3, 17, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...rgb);
    doc.setCharSpace(0);
    doc.text(clean(title), ML + 10, y + 11);
    y += 24;
  }

  function itemBlock(text, opts = {}) {
    const { dotRgb = [120,130,150], indent = 14 } = opts;
    const lines = doc.splitTextToSize(clean(text), CW - indent);
    const bH = lines.length * LH + 8;
    checkPage(bH + 4);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(ML, y, CW, bH, 3, 3, 'F');
    doc.setFillColor(...dotRgb);
    doc.circle(ML + 6, y + bH / 2, 2.2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 60, 80);
    doc.setCharSpace(0);
    lines.forEach((line, i) => { doc.text(line, ML + indent, y + 7 + i * LH); });
    y += bH + 4;
  }

  function numberedBlock(num, text, rgb) {
    const lines = doc.splitTextToSize(clean(text), CW - 22);
    const bH = lines.length * LH + 8;
    checkPage(bH + 4);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(ML, y, CW, bH, 3, 3, 'F');
    doc.setFillColor(...rgb);
    doc.circle(ML + 8, y + bH / 2, 7, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0);
    doc.text(String(num), ML + 8, y + bH / 2 + 2.5, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 60, 80);
    doc.setCharSpace(0);
    lines.forEach((line, i) => { doc.text(line, ML + 22, y + 7 + i * LH); });
    y += bH + 4;
  }

  /* ══ HEADER ══ */
  // Dark band
  doc.setFillColor(11, 13, 20);
  doc.rect(0, 0, W, 82, 'F');
  // Accent top stripe
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, W, 4, 'F');
  // Brand
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(241, 245, 249);
  doc.setCharSpace(0);
  doc.text('Kairix AI', ML, 34);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(139, 154, 181);
  doc.text('Career Intelligence Report', ML, 52);
  // Goal
  const goalStr = jobGoalText ? clean(jobGoalText).substring(0, 90) : '';
  if (goalStr) {
    doc.setFontSize(8);
    doc.setTextColor(90, 105, 130);
    doc.setCharSpace(0);
    doc.text('Goal: ' + goalStr, ML, 68);
  }
  // Score badge
  doc.setFillColor(...scoreRgb);
  doc.roundedRect(W - MR - 68, 16, 68, 50, 8, 8, 'F');
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setCharSpace(0);
  doc.text(`${score}`, W - MR - 34, 45, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('/10', W - MR - 34, 58, { align: 'center' });

  y = 100;

  /* ── Score explanation ── */
  txt(f.score_explanation || '', { size: 9, color: [90, 100, 120] });
  y += 6;

  /* ── Motivational quote ── */
  const quoteLines = doc.splitTextToSize(`"${clean(f.motivational_message || '')}"`, CW - 18);
  const quoteH = quoteLines.length * LH + 14;
  checkPage(quoteH + 10);
  doc.setFillColor(237, 238, 255);
  doc.roundedRect(ML, y, CW, quoteH, 4, 4, 'F');
  doc.setFillColor(99, 102, 241);
  doc.rect(ML, y, 3, quoteH, 'F');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(55, 55, 120);
  doc.setCharSpace(0);
  quoteLines.forEach((line, i) => { doc.text(line, ML + 12, y + 12 + i * LH); });
  y += quoteH + 12;

  /* ══ SECTIONS ══ */
  sectionHeader("What's Working", [34,197,94]);
  (f.strengths || []).forEach(s => itemBlock(s, { dotRgb: [34,197,94] }));

  sectionHeader('Skill Gaps', [245,158,11]);
  (f.skill_gaps || []).forEach(s => itemBlock(s, { dotRgb: [245,158,11] }));

  sectionHeader('CV Improvements', [59,130,246]);
  (f.cv_improvements || []).forEach(s => itemBlock(s, { dotRgb: [59,130,246] }));

  sectionHeader('Action Plan', [99,102,241]);
  (f.next_steps || []).forEach((s, i) => numberedBlock(i + 1, s, [99,102,241]));

  sectionHeader('Interview Questions to Prepare', [168,85,247]);
  (f.interview_questions || []).forEach((q, i) => {
    const lines = doc.splitTextToSize(clean(q), CW - 22);
    const bH = lines.length * LH + 8;
    checkPage(bH + 4);
    doc.setFillColor(250, 248, 255);
    doc.roundedRect(ML, y, CW, bH, 3, 3, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(168, 85, 247);
    doc.setCharSpace(0);
    doc.text(`Q${i+1}`, ML + 6, y + 7 + (bH / 2) - 4);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(55, 60, 80);
    doc.setCharSpace(0);
    lines.forEach((line, li) => { doc.text(line, ML + 22, y + 7 + li * LH); });
    y += bH + 4;
  });

  sectionHeader('Recommended Resources', [59,130,246]);
  (f.recommended_resources || []).forEach((r, i) => {
    const parts  = r.split(' — ');
    const name   = clean(parts[0] || r);
    const why    = clean(parts.slice(1).join(' — '));
    const whyLines = why ? doc.splitTextToSize(why, CW - 18) : [];
    const bH = LH + (whyLines.length ? whyLines.length * (LH - 1) + 4 : 0) + 10;
    checkPage(bH + 4);
    doc.setFillColor(240, 246, 255);
    doc.roundedRect(ML, y, CW, bH, 3, 3, 'F');
    doc.setFillColor(59, 130, 246);
    doc.circle(ML + 8, y + 7 + LH / 2 - 4, 6, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setCharSpace(0);
    doc.text(`${i+1}`, ML + 8, y + 7 + LH / 2 - 1.5, { align: 'center' });
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 40, 70);
    doc.setCharSpace(0);
    doc.text(name, ML + 20, y + 9);
    if (whyLines.length) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 115, 140);
      doc.setCharSpace(0);
      whyLines.forEach((line, li) => { doc.text(line, ML + 20, y + 9 + LH + li * (LH - 1)); });
    }
    y += bH + 4;
  });

  /* ── JD Match ── */
  if (f.jd_match && f.jd_match.match_score != null) {
    const jdRgb = f.jd_match.match_score >= 70 ? [34,197,94] : f.jd_match.match_score >= 45 ? [245,158,11] : [239,68,68];
    sectionHeader(`ATS Match: ${f.jd_match.match_score}%  —  ${f.jd_match.ats_verdict}`, jdRgb);

    if ((f.jd_match.missing_keywords || []).length) {
      checkPage(24);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68);
      doc.setCharSpace(0);
      doc.text('Missing keywords:', ML, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 70, 90);
      const kwLines = doc.splitTextToSize(clean(f.jd_match.missing_keywords.join(', ')), CW - 105);
      doc.text(kwLines[0] || '', ML + 105, y);
      y += LH;
      kwLines.slice(1).forEach(line => { checkPage(LH); doc.text(line, ML, y); y += LH; });
      y += 4;
    }
    (f.jd_match.jd_advice || []).forEach(s => itemBlock(s, { dotRgb: jdRgb }));
  }

  drawFooter();
  doc.save('kairix-career-report.pdf');
});

/* ─── RESET ─── */
resetBtn.addEventListener('click', resetApp);

function resetApp() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  selectedFile = null; jobGoalText = ''; currentFeedback = null;

  cvFileInput.value = '';
  dropIdle.classList.remove('hidden');
  dropDone.classList.add('hidden');
  document.getElementById('status-1').textContent = '';
  document.getElementById('status-1').className = 'fcard-status';

  setVoiceState('idle');
  document.getElementById('status-2').textContent = '';
  document.getElementById('status-2').className = 'fcard-status';
  document.getElementById('status-3').textContent = '';
  document.getElementById('status-3').className = 'fcard-status';
  tcText.textContent = '';
  jobGoalInput.value = '';
  jdInput.value = '';
  userEmailInput.value = '';

  expandFcard(1);
  expandFcard(2);

  hideError();
  resultsEl.classList.add('hidden');
  jdMatchSection.classList.add('hidden');
  scoreRingFill.style.strokeDashoffset = RING_C;
  scoreNumber.textContent = '—';
  scoreExplanation.textContent = '';
  motivationalMessage.textContent = '';
  [strengthsList, skillGapsList, cvImprovementsList, nextStepsList,
   interviewQuestionsList, resourcesList].forEach(el => el.innerHTML = '');

  setStep(1);
  updateCTA();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─── HERO CANVAS PARTICLE ANIMATION ─── */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const mouse = { x: -999, y: -999 };
  const MAX_P = 55, LINK_DIST = 130, MOUSE_DIST = 160;

  function resize() {
    const hero = canvas.parentElement;
    W = canvas.width  = hero.offsetWidth;
    H = canvas.height = hero.offsetHeight;
  }

  function mkParticle() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r:  Math.random() * 1.4 + 0.4,
      op: Math.random() * 0.45 + 0.15,
    };
  }

  resize();
  for (let i = 0; i < MAX_P; i++) particles.push(mkParticle());

  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    mouse.x = (lx >= 0 && lx <= W && ly >= 0 && ly <= H) ? lx : -999;
    mouse.y = (lx >= 0 && lx <= W && ly >= 0 && ly <= H) ? ly : -999;
  });

  let raf;
  function draw() {
    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(99,102,241,${p.op})`;
      ctx.fill();
    });

    // Particle-to-particle links
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(99,102,241,${(1 - d / LINK_DIST) * 0.14})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Mouse proximity links
      const mx = particles[i].x - mouse.x;
      const my = particles[i].y - mouse.y;
      const md = Math.sqrt(mx * mx + my * my);
      if (md < MOUSE_DIST) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = `rgba(168,85,247,${(1 - md / MOUSE_DIST) * 0.3})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    raf = requestAnimationFrame(draw);
  }

  draw();
  window.addEventListener('resize', () => {
    resize();
    particles = [];
    for (let i = 0; i < MAX_P; i++) particles.push(mkParticle());
  });
}

/* ─── CURSOR GLOW ─── */
function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  if (!glow) return;

  let cx = -300, cy = -300, tx = -300, ty = -300;

  document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });

  function animate() {
    cx += (tx - cx) * 0.09;
    cy += (ty - cy) * 0.09;
    glow.style.transform = `translate(${cx - 200}px, ${cy - 200}px)`;
    requestAnimationFrame(animate);
  }
  animate();
}

/* ─── SCROLL REVEAL ─── */
function initScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length || !('IntersectionObserver' in window)) {
    // Fallback: make all visible immediately
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
}

/* ─── PREVENT SPACEBAR PAGE SCROLL ─── */
window.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (!['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(tag)) {
      e.preventDefault();
    }
  }
});

/* ─── BOOT ─── */
setStep(1);
setVoiceState('idle');
updateCTA();

if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion) {
  initHeroCanvas();
  initCursorGlow();
}
initScrollReveal();
