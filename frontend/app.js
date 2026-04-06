const API_BASE = "http://127.0.0.1:8000";
let currentVideoId = null;
let currentUrl = null;
let messageCounter = 0;
let queryHistory = [];
let videoHistory = {};
let isSpeaking = false;
let recognition = null;
let isListening = false;
let silenceTimer = null;
let notesData = null;
let quizData = null;
let quizAnswers = {};
let quizSubmitted = false;
let isAsking = false; // ← prevents double-fire from simultaneous clicks

// ── Page navigation ────────────────────────────────────────────

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
    p.style.display = 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  target.classList.remove('hidden');
  target.style.display = '';
  target.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'history') renderHistory();
}

function showTab(id, btn) {
  ['chat','summary','notes','quiz'].forEach(t => {
    document.getElementById('tab-' + t).classList.add('hidden');
  });
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.remove('hidden');
  btn.classList.add('active');
}

// ── Home → Analyzer ───────────────────────────────────────────

function goAnalyze() {
  const url = document.getElementById('heroUrl').value.trim();
  showPage('analyzer', document.querySelectorAll('.nav-btn')[1]);
  if (url) {
    document.getElementById('videoUrl').value = url;
    processVideo();
  } else {
    setTimeout(() => document.getElementById('videoUrl').focus(), 100);
  }
}

function resetAnalyzer() {
  document.getElementById('analyzerHero').classList.remove('hidden');
  document.getElementById('analyzerMain').classList.add('hidden');
  document.getElementById('videoUrl').value = '';
  document.getElementById('processStatus').classList.add('hidden');
  currentVideoId = null;
  currentUrl = null;
}

// ── Fetch video title via oEmbed ───────────────────────────────

async function fetchVideoTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return data.title || videoId;
    }
  } catch {}
  return videoId;
}

// ── Process video ──────────────────────────────────────────────

async function processVideo() {
  const url = document.getElementById("videoUrl").value.trim();
  const btn = document.getElementById("processBtn");
  if (!url) { showStatus("Please enter a YouTube URL.", "error"); return; }
  if (btn.disabled) return;
  btn.disabled = true;
  showStatus("Processing video…", "loading");

  try {
    const res = await fetch(`${API_BASE}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) { showStatus(`Error: ${data.detail}`, "error"); btn.disabled = false; return; }

    const videoId = data.video_id;
    currentVideoId = videoId;
    currentUrl = url;

    fetchVideoTitle(videoId).then(title => {
      if (videoHistory[videoId]) videoHistory[videoId].title = title;
    });

    if (!videoHistory[videoId]) {
      videoHistory[videoId] = { url, title: videoId, queries: [], chatMessages: [] };
    }

    document.getElementById('analyzerHero').classList.add('hidden');
    document.getElementById('analyzerMain').classList.remove('hidden');
    document.getElementById('compactUrlText').textContent = url;
    document.getElementById('compactStatus').textContent = '✓ ' + data.message;

    showVideoPreview(videoId);
    document.getElementById("suggestedSection").classList.remove("hidden");
    document.getElementById("chatSection").classList.remove("hidden");

    // Clear everything for new video
    document.getElementById("chatBox").innerHTML = "";
    notesData = null; quizData = null; quizSubmitted = false; isAsking = false;
    document.getElementById("summaryContent").innerHTML = `<div class="placeholder-text">Click "Generate summary" to start.</div>`;
    document.getElementById("notesContent").innerHTML  = `<div class="placeholder-text">Click "Generate notes" to start.</div>`;
    document.getElementById("quizContent").innerHTML   = `<div class="placeholder-text">Click "Generate quiz" to start.</div>`;
    document.getElementById("downloadNotesBtn").style.display = "none";

    appendBotMessage("Video loaded! Ask me anything about it.", false);
    setTimeout(() => document.getElementById("questionInput").focus(), 100);

  } catch {
    showStatus("Could not connect to backend.", "error");
  } finally {
    btn.disabled = false;
  }
}

function showStatus(msg, type) {
  const el = document.getElementById("processStatus");
  el.textContent = msg; el.className = `status-msg ${type}`; el.classList.remove("hidden");
}

function showVideoPreview(videoId) {
  document.getElementById("videoFrame").src = `https://www.youtube.com/embed/${videoId}`;
  document.getElementById("videoPreview").classList.remove("hidden");
}

// ── Resume chat from history ───────────────────────────────────

function resumeChat(videoId) {
  const entry = videoHistory[videoId];
  if (!entry) return;
  currentVideoId = videoId; currentUrl = entry.url;
  showPage('analyzer', document.querySelectorAll('.nav-btn')[1]);
  document.getElementById('analyzerHero').classList.add('hidden');
  document.getElementById('analyzerMain').classList.remove('hidden');
  document.getElementById('compactUrlText').textContent = entry.url;
  document.getElementById('compactStatus').textContent = '✓ Resumed from history';
  showVideoPreview(videoId);
  document.getElementById("suggestedSection").classList.remove("hidden");
  document.getElementById("chatSection").classList.remove("hidden");

  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";
  entry.chatMessages.forEach(m => {
    if (m.role === 'user') {
      const row = document.createElement("div");
      row.className = "msg-row user"; row.id = `msg-${++messageCounter}`;
      row.innerHTML = `<div class="bubble">${escapeHtml(m.text)}</div>`;
      chatBox.appendChild(row);
    } else {
      appendBotMessage(m.text, false);
    }
  });
  chatBox.scrollTop = chatBox.scrollHeight;
  setTimeout(() => document.getElementById("questionInput").focus(), 100);
}

// ── Ask question — debounced to prevent double-fire ────────────

async function askQuestion() {
  if (isAsking) return; // ← prevent simultaneous calls
  const input = document.getElementById("questionInput");
  const question = input.value.trim();
  if (!question || !currentVideoId) return;

  isAsking = true;
  input.value = "";
  input.disabled = true;

  appendUserMessage(question);
  const loadingId = appendLoading();

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: currentVideoId, question }),
    });
    const data = await res.json();
    removeMessage(loadingId);
    if (!res.ok) { appendBotMessage(`Error: ${data.detail}`); return; }
    appendBotMessage(data.answer);
    const entry = { question, answer: data.answer, time: getTime(), videoId: currentVideoId };
    queryHistory.push(entry);
    if (videoHistory[currentVideoId]) videoHistory[currentVideoId].queries.push(entry);
  } catch {
    removeMessage(loadingId);
    appendBotMessage("Request failed. Check backend connection.");
  } finally {
    input.disabled = false;
    input.focus();
    isAsking = false; // ← unlock after request completes
  }
}

function askSuggested(btn) {
  if (isAsking) return; // ← also block if already asking
  document.getElementById("questionInput").value = btn.textContent;
  showTab('chat', document.querySelector('.tab'));
  askQuestion();
}

// ── Chat helpers ───────────────────────────────────────────────

function appendUserMessage(text) {
  const chatBox = document.getElementById("chatBox");
  const row = document.createElement("div");
  row.className = "msg-row user"; row.id = `msg-${++messageCounter}`;
  row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (currentVideoId && videoHistory[currentVideoId])
    videoHistory[currentVideoId].chatMessages.push({ role: 'user', text });
}

function appendBotMessage(text, saveToHistory = true) {
  const chatBox = document.getElementById("chatBox");
  const row = document.createElement("div");
  row.className = "msg-row bot"; row.id = `msg-${++messageCounter}`;
  row.innerHTML = `
    <div class="bubble">${escapeHtml(text)}</div>
    <div class="msg-actions">
      <button class="action-btn" title="Read aloud" onclick="speakText(${JSON.stringify(text)}, this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
      <button class="action-btn" title="Copy" onclick="copyText(${JSON.stringify(text)}, this)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
      <span class="msg-time">${getTime()}</span>
    </div>
  `;
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  if (saveToHistory && currentVideoId && videoHistory[currentVideoId])
    videoHistory[currentVideoId].chatMessages.push({ role: 'bot', text });
  return row.id;
}

function appendLoading() {
  const chatBox = document.getElementById("chatBox");
  const row = document.createElement("div");
  row.className = "msg-row bot"; row.id = `msg-${++messageCounter}`;
  row.innerHTML = `<div class="typing-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  return row.id;
}

function removeMessage(id) { const el = document.getElementById(id); if (el) el.remove(); }

function escapeHtml(text) {
  return String(text)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Copy / Speak ───────────────────────────────────────────────

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add("copied");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 2000);
  });
}

function speakText(text, btn) {
  if (!window.speechSynthesis) return;
  if (isSpeaking) {
    window.speechSynthesis.cancel(); isSpeaking = false; btn.classList.remove("speaking"); return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN"; utterance.rate = 0.95;
  utterance.onstart = () => { isSpeaking = true; btn.classList.add("speaking"); };
  utterance.onend = utterance.onerror = () => { isSpeaking = false; btn.classList.remove("speaking"); };
  window.speechSynthesis.speak(utterance);
}

// ── Summary ────────────────────────────────────────────────────

async function generateSummary() {
  if (!currentUrl) return;
  const el = document.getElementById("summaryContent");
  el.innerHTML = `<div class="typing-dots" style="margin:1rem 0"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/summarize`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();
    if (!res.ok) { el.textContent = `Error: ${data.detail}`; return; }
    const topics = (data.key_topics || []).map(t => `<span class="topic-pill">${escapeHtml(t)}</span>`).join("");
    el.innerHTML = `
      <div class="summary-card"><div class="summary-section-label">Summary</div><div class="summary-text">${escapeHtml(data.summary)}</div></div>
      ${data.quick_summary?`<div class="summary-card"><div class="summary-section-label">Quick summary</div><div class="summary-text">${escapeHtml(data.quick_summary)}</div></div>`:""}
      <div class="summary-card"><div class="summary-section-label">Key topics</div><div class="topic-pills">${topics}</div></div>
    `;
  } catch { el.textContent = "Failed to generate summary."; }
}

// ── Notes ──────────────────────────────────────────────────────

async function generateNotes() {
  if (!currentUrl) return;
  const el = document.getElementById("notesContent");
  el.innerHTML = `<div class="typing-dots" style="margin:1rem 0"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  try {
    const res = await fetch(`${API_BASE}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();
    if (!res.ok) { el.textContent = `Error: ${data.detail}`; return; }
    notesData = data;
    document.getElementById("downloadNotesBtn").style.display = "inline-block";
    const bullets = (data.bullet_points||[]).map(b=>`<li>${escapeHtml(b)}</li>`).join("");
    const terms   = (data.key_terms||[]).map(t=>`<div class="key-term-card"><div class="key-term-name">${escapeHtml(t.term)}</div><div class="key-term-def">${escapeHtml(t.definition)}</div></div>`).join("");
    const facts   = (data.important_facts||[]).map(f=>`<div class="fact-item"><div class="fact-dot"></div>${escapeHtml(f)}</div>`).join("");
    el.innerHTML = `
      <div class="notes-section"><div class="notes-title">${escapeHtml(data.title||"Study Notes")}</div><div class="notes-summary">${escapeHtml(data.summary||"")}</div></div>
      ${bullets?`<div class="notes-section"><div class="section-label">Key points</div><ul class="bullet-list">${bullets}</ul></div>`:""}
      ${terms?`<div class="notes-section"><div class="section-label">Key terms</div><div class="key-terms-grid">${terms}</div></div>`:""}
      ${facts?`<div class="notes-section"><div class="section-label">Important facts</div><div class="facts-list">${facts}</div></div>`:""}
    `;
  } catch { el.textContent = "Failed to generate notes."; }
}

// ── PDF download ───────────────────────────────────────────────

function downloadNotesPDF() {
  if (!notesData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const orange=[249,115,22], dark=[20,20,20], grey=[120,120,120];
  const lw=180, lm=15; let y=20;
  doc.setFillColor(...orange); doc.rect(0,0,210,12,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('VideoAnalyzer — Study Notes', lm, 8);
  y=24; doc.setTextColor(...dark); doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text(notesData.title||'Study Notes', lm, y); y+=7;
  if(notesData.summary){doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...grey);const sl=doc.splitTextToSize(notesData.summary,lw);doc.text(sl,lm,y);y+=sl.length*5+6;}
  if(notesData.bullet_points?.length){doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...orange);doc.text('KEY POINTS',lm,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...dark);notesData.bullet_points.forEach((b,i)=>{const lines=doc.splitTextToSize(`${i+1}. ${b}`,lw-4);if(y+lines.length*5>280){doc.addPage();y=15;}doc.text(lines,lm+2,y);y+=lines.length*5+2;});y+=4;}
  if(notesData.key_terms?.length){if(y+10>280){doc.addPage();y=15;}doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...orange);doc.text('KEY TERMS',lm,y);y+=6;notesData.key_terms.forEach(t=>{if(y+12>280){doc.addPage();y=15;}doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(...dark);doc.text(t.term,lm+2,y);y+=4;doc.setFont('helvetica','normal');doc.setTextColor(...grey);const dl=doc.splitTextToSize(t.definition,lw-6);doc.text(dl,lm+4,y);y+=dl.length*4+3;});y+=2;}
  if(notesData.important_facts?.length){if(y+10>280){doc.addPage();y=15;}doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(...orange);doc.text('IMPORTANT FACTS',lm,y);y+=6;doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(...dark);notesData.important_facts.forEach(f=>{const lines=doc.splitTextToSize(`• ${f}`,lw-4);if(y+lines.length*5>280){doc.addPage();y=15;}doc.text(lines,lm+2,y);y+=lines.length*5+2;});}
  const pc=doc.internal.getNumberOfPages();for(let i=1;i<=pc;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...grey);doc.text(`VideoAnalyzer · Page ${i} of ${pc}`,lm,293);}
  doc.save(`notes-${currentVideoId||'video'}.pdf`);
}

// ── Quiz ───────────────────────────────────────────────────────

async function generateQuiz() {
  if (!currentUrl) return;
  const el = document.getElementById("quizContent");
  el.innerHTML = `<div class="typing-dots" style="margin:1rem 0"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  quizAnswers = {}; quizSubmitted = false;
  try {
    const res = await fetch(`${API_BASE}/quiz`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();
    if (!res.ok) { el.textContent = `Error: ${data.detail}`; return; }
    quizData = data.questions; renderQuiz(quizData, el);
  } catch { el.textContent = "Failed to generate quiz."; }
}

function renderQuiz(questions, el) {
  if (!questions||!questions.length){el.textContent="Could not generate quiz.";return;}
  const html=questions.map((q,qi)=>`
    <div class="quiz-question" id="quiz-q-${qi}">
      <div class="quiz-q-text">${qi+1}. ${escapeHtml(q.question)}</div>
      <div class="quiz-options">
        ${q.options.map((opt,oi)=>`<button class="quiz-option" onclick="selectAnswer(${qi},${oi},${q.correct})" id="quiz-opt-${qi}-${oi}">${String.fromCharCode(65+oi)}. ${escapeHtml(opt)}</button>`).join("")}
      </div>
    </div>`).join("");
  el.innerHTML=html+`<button class="btn-outline" id="submitQuizBtn" style="margin-top:1rem" onclick="showQuizScore()">Submit quiz</button>`;
}

function selectAnswer(qi,oi,correct){
  quizAnswers[qi]=oi;
  const opts=document.querySelectorAll(`[id^="quiz-opt-${qi}-"]`);
  opts.forEach(o=>{o.classList.remove("correct","wrong");o.disabled=true;});
  document.getElementById(`quiz-opt-${qi}-${oi}`).classList.add(oi===correct?"correct":"wrong");
  if(oi!==correct)document.getElementById(`quiz-opt-${qi}-${correct}`).classList.add("correct");
}

function showQuizScore(){
  if(!quizData||quizSubmitted)return;
  quizSubmitted=true;
  let score=0;
  quizData.forEach((q,i)=>{if(quizAnswers[i]===q.correct)score++;});
  const submitBtn=document.getElementById("submitQuizBtn");
  if(submitBtn)submitBtn.remove();
  const el=document.getElementById("quizContent");
  const scoreEl=document.createElement("div");
  scoreEl.className="quiz-score";
  scoreEl.textContent=`Your score: ${score} / ${quizData.length}`;
  el.appendChild(scoreEl);
  scoreEl.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ── History ────────────────────────────────────────────────────

function renderHistory(){
  const el=document.getElementById("historyList");
  const videos=Object.entries(videoHistory);
  if(!videos.length){
    el.innerHTML=`<div class="history-empty"><div class="history-empty-icon">📭</div><div>No videos analyzed yet.</div><button class="btn-primary" style="margin-top:1rem" onclick="showPage('analyzer',document.querySelectorAll('.nav-btn')[1])">Analyze a video</button></div>`;
    return;
  }
  el.innerHTML=videos.map(([videoId,data])=>{
    const title=data.title!==videoId?data.title:`Video: ${videoId}`;
    const count=data.queries.length;
    const shortUrl=data.url.length>65?data.url.slice(0,65)+'…':data.url;
    const qaItems=data.queries.map(q=>`<div class="history-qa-item"><div class="history-q">${escapeHtml(q.question)}</div><div class="history-a">${escapeHtml(q.answer)}</div><div class="history-item-time">${q.time}</div></div>`).join("");
    return `<div class="history-video-card">
      <div class="history-video-header">
        <div class="history-video-info">
          <div class="history-video-title">${escapeHtml(title)}</div>
          <div class="history-video-url" title="${escapeHtml(data.url)}">${escapeHtml(shortUrl)}</div>
        </div>
        <div class="history-video-actions">
          <span class="history-meta">${count} Q&amp;A</span>
          <button class="history-resume-btn" onclick="resumeChat('${videoId}')">▶ Resume chat</button>
          <span class="history-toggle" id="toggle-${videoId}" onclick="toggleHistoryCard('${videoId}')">▼</span>
        </div>
      </div>
      <div class="history-qa-list" id="qa-${videoId}">
        ${count===0?`<div class="placeholder-text">No questions asked yet.</div>`:qaItems}
      </div>
    </div>`;
  }).join("");
}

function toggleHistoryCard(videoId){
  document.getElementById(`qa-${videoId}`).classList.toggle('open');
  document.getElementById(`toggle-${videoId}`).classList.toggle('open');
}

// ── Voice ──────────────────────────────────────────────────────

function initSpeechRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return;
  recognition=new SR();
  recognition.lang="en-IN"; recognition.continuous=true; recognition.interimResults=true;
  recognition.onresult=(event)=>{
    let final="",interim="";
    for(let i=event.resultIndex;i<event.results.length;i++){
      if(event.results[i].isFinal)final+=event.results[i][0].transcript;
      else interim+=event.results[i][0].transcript;
    }
    const input=document.getElementById("questionInput");
    input.value=final||interim;
    if(silenceTimer)clearTimeout(silenceTimer);
    silenceTimer=setTimeout(()=>{if(input.value.trim()){stopListening();askQuestion();}},1500);
  };
  recognition.onerror=(e)=>{stopListening();if(e.error==="not-allowed")appendBotMessage("Microphone access denied.",false);};
  recognition.onend=()=>stopListening();
}
function toggleMic(){if(!recognition){appendBotMessage("Voice input not supported. Use Chrome.",false);return;}isListening?stopListening():startListening();}
function startListening(){if(!currentVideoId){appendBotMessage("Please process a video first.",false);return;}isListening=true;document.getElementById("micBtn").classList.add("active");setTimeout(()=>recognition.start(),200);}
function stopListening(){isListening=false;const btn=document.getElementById("micBtn");if(btn)btn.classList.remove("active");try{recognition.stop();}catch{}}

// ── Init ───────────────────────────────────────────────────────
// ─── Theme Toggle ─────────────────────────────────────────────────────────────

function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  document.getElementById("themeBtn").textContent = isLight ? "🌙" : "☀️";
  localStorage.setItem("theme", isLight ? "light" : "dark");
}

document.addEventListener("DOMContentLoaded", () => {
  showPage('home', document.querySelector('.nav-btn'));
  document.getElementById("questionInput").addEventListener("keydown", e => { if(e.key==="Enter") askQuestion(); });
  document.getElementById("videoUrl").addEventListener("keydown", e => { if(e.key==="Enter") processVideo(); });
  initSpeechRecognition();
  // load saved theme
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
    document.getElementById("themeBtn").textContent = "🌙";
  } else {
    document.getElementById("themeBtn").textContent = "☀️";
  }
});