/* ─── STATE ─── */
let selectedFile    = null;
let jobGoalText     = '';
let currentFeedback = null;
let recognition     = null;
let isRecording     = false;
let loadingTimers   = [];

const API_BASE = 'http://localhost:8000';
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

/* ─── STEPPER (4 steps) ─── */
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
  const allowed = ['image/jpeg','image/png','image/webp','application/pdf'];
  if (!allowed.includes(file.type)) { showError('Invalid file type. Please upload a JPG, PNG, WEBP, or PDF.'); return; }
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
}

function clearFile() {
  selectedFile = null;
  cvFileInput.value = '';
  dropIdle.classList.remove('hidden');
  dropDone.classList.add('hidden');
  document.getElementById('status-1').textContent = '';
  document.getElementById('status-1').className = 'fcard-status';
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
    updateGoalDone();
  } else {
    setVoiceState('idle');
    document.getElementById('status-2').textContent = '';
    document.getElementById('status-2').className = 'fcard-status';
  }
  updateCTA();
});

function updateGoalDone() {
  document.getElementById('status-2').textContent = '✓';
  document.getElementById('status-2').className = 'fcard-status done';
  if (selectedFile) setStep(4); else setStep(3);
  updateCTA();
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

/* ─── LOADING OVERLAY ─── */
function showLoading() {
  loadingOverlay.classList.remove('hidden');
  ['ovs-1','ovs-2','ovs-3'].forEach(id => {
    document.getElementById(id).className = 'ov-step';
  });
  ovBar.style.width = '0%';

  document.getElementById('ovs-1').classList.add('active');
  requestAnimationFrame(() => { ovBar.style.width = '20%'; });

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
    'CareerLens AI — Career Intelligence Report',
    '===========================================',
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
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 48;
  const lineH = 16;
  let y = margin;

  const addText = (text, opts = {}) => {
    const { size = 10, bold = false, color = [50, 50, 70], indent = 0, wrap = true } = opts;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    const maxW = W - margin * 2 - indent;
    if (wrap) {
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach(line => {
        if (y > doc.internal.pageSize.getHeight() - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin + indent, y);
        y += lineH;
      });
    } else {
      doc.text(text, margin + indent, y);
      y += lineH;
    }
  };

  const addSection = (title) => {
    y += 8;
    doc.setFillColor(99, 102, 241);
    doc.rect(margin, y - 11, 3, lineH, 'F');
    addText(title, { size: 11, bold: true, color: [99, 102, 241], indent: 10 });
    y += 2;
  };

  const addListItems = (items) => {
    (items || []).forEach(item => {
      addText(`• ${item}`, { indent: 8 });
    });
  };

  // Header
  doc.setFillColor(8, 9, 13);
  doc.rect(0, 0, W, 70, 'F');
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CareerLens AI — Career Intelligence Report', margin, 30);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(139, 154, 181);
  doc.text(`Score: ${f.overall_score}/10  |  Goal: ${(f.job_goal || '').substring(0, 60)}`, margin, 50);
  y = 90;

  addText(f.score_explanation || '', { color: [100, 110, 140] });
  y += 4;
  addText(`"${f.motivational_message || ''}"`, { bold: true, color: [99, 102, 241] });
  y += 8;

  addSection('What\'s Working');
  addListItems(f.strengths);

  addSection('Skill Gaps');
  addListItems(f.skill_gaps);

  addSection('CV Improvements');
  addListItems(f.cv_improvements);

  addSection('Action Plan');
  (f.next_steps || []).forEach((s, i) => addText(`${i+1}. ${s}`, { indent: 8 }));

  addSection('Interview Questions to Prepare');
  (f.interview_questions || []).forEach((q, i) => addText(`Q${i+1}: ${q}`, { indent: 8 }));

  addSection('Recommended Resources');
  addListItems(f.recommended_resources);

  if (f.jd_match && f.jd_match.match_score != null) {
    addSection(`Job Description Match: ${f.jd_match.match_score}% (${f.jd_match.ats_verdict})`);
    addText('Missing keywords: ' + (f.jd_match.missing_keywords || []).join(', '), { color: [239, 68, 68] });
    addListItems(f.jd_match.jd_advice);
  }

  doc.save('careerlens-report.pdf');
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

/* ─── BOOT ─── */
setStep(1);
setVoiceState('idle');
updateCTA();
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
