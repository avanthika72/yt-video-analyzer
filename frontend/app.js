const API_BASE = "http://127.0.0.1:8000";
let currentVideoId = null;
let currentUrl = null;
let messageCounter = 0;
let queryHistory = [];
let isSpeaking = false;
let recognition = null;
let isListening = false;
let silenceTimer = null;
let notesData = null;
let quizData = null;
let quizAnswers = {};

// ─── Navigation ───────────────────────────────────────────────────────────────

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
    p.style.display = 'none';
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById('page-' + id);
  target.classList.remove('hidden');
  target.style.display = 'block';
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

// ─── Process Video ─────────────────────────────────────────────────────────────

async function processVideo() {
  const url = document.getElementById("videoUrl").value.trim();
  const btn = document.getElementById("processBtn");

  if (!url) { showStatus("Please enter a YouTube URL.", "error"); return; }
  if (btn.disabled) return;

  btn.disabled = true;
  showStatus("Processing video...", "loading");

  try {
    const res = await fetch(`${API_BASE}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    if (!res.ok) { showStatus(`Error: ${data.detail}`, "error"); btn.disabled = false; return; }

    currentVideoId = data.video_id;
    currentUrl = url;

    showStatus(`✓ ${data.message}`, "success");
    showVideoPreview(data.video_id);

    document.getElementById("suggestedSection").classList.remove("hidden");
    document.getElementById("chatSection").classList.remove("hidden");
    document.getElementById("chatBox").innerHTML = "";
    appendBotMessage("Video loaded! Ask me anything about it.");

    // auto focus question input
    setTimeout(() => document.getElementById("questionInput").focus(), 100);

  } catch {
    showStatus("Could not connect to backend.", "error");
  } finally {
    btn.disabled = false;
  }
}

function showStatus(msg, type) {
  const el = document.getElementById("processStatus");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  el.classList.remove("hidden");
}

function showVideoPreview(videoId) {
  const preview = document.getElementById("videoPreview");
  const frame = document.getElementById("videoFrame");
  frame.src = `https://www.youtube.com/embed/${videoId}`;
  preview.classList.remove("hidden");
}

// ─── Ask Question ──────────────────────────────────────────────────────────────

async function askQuestion() {
  const input = document.getElementById("questionInput");
  const question = input.value.trim();
  if (!question || !currentVideoId) return;

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
    queryHistory.push({ question, answer: data.answer, time: getTime(), videoId: currentVideoId });

  } catch {
    removeMessage(loadingId);
    appendBotMessage("Request failed. Check backend connection.");
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function askSuggested(btn) {
  document.getElementById("questionInput").value = btn.textContent;
  showTab('chat', document.querySelector('.tab'));
  askQuestion();
}

// ─── Message Rendering ─────────────────────────────────────────────────────────

function appendUserMessage(text) {
  const chatBox = document.getElementById("chatBox");
  const row = document.createElement("div");
  row.className = "msg-row user";
  row.id = `msg-${++messageCounter}`;
  row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendBotMessage(text) {
  const chatBox = document.getElementById("chatBox");
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.id = `msg-${++messageCounter}`;

  const safeText = escapeHtml(text);
  const rawText = text;

  row.innerHTML = `
    <div class="bubble">${safeText}</div>
    <div class="msg-actions">
      <button class="action-btn" data-text="${safeText}" onclick="speakText(this.dataset.text, this)">&#9654; Read</button>
      <button class="action-btn" data-text="${safeText}" onclick="copyText(this.dataset.text, this)">&#128203; Copy</button>
      <span class="msg-time">${getTime()}</span>
    </div>
  `;

  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  return row.id;
}

function appendLoading() {
  const chatBox = document.getElementById("chatBox");
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.id = `msg-${++messageCounter}`;
  row.innerHTML = `<div class="typing-dots"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  return row.id;
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "✓ Copied";
    btn.classList.add("copied");
    setTimeout(() => { btn.innerHTML = "&#128203; Copy"; btn.classList.remove("copied"); }, 2000);
  });
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

function speakText(text, btn) {
  if (!window.speechSynthesis) return;

  if (isSpeaking) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
    document.querySelectorAll(".action-btn").forEach(b => {
      if (b.textContent.includes("Stop")) { b.innerHTML = "&#9654; Read"; b.classList.remove("speaking"); }
    });
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 0.95;

  utterance.onstart = () => { isSpeaking = true; btn.innerHTML = "&#9646;&#9646; Stop"; btn.classList.add("speaking"); };
  utterance.onend = utterance.onerror = () => { isSpeaking = false; btn.innerHTML = "&#9654; Read"; btn.classList.remove("speaking"); };

  window.speechSynthesis.speak(utterance);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

async function generateSummary() {
  if (!currentUrl) return;
  const el = document.getElementById("summaryContent");
  el.innerHTML = `<div class="typing-dots" style="margin:1rem 0"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;

  try {
    const res = await fetch(`${API_BASE}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();
    if (!res.ok) { el.textContent = `Error: ${data.detail}`; return; }

    const topics = (data.key_topics || []).map(t => `<span class="topic-pill">${t}</span>`).join("");
    el.innerHTML = `
      <div class="summary-card">
        <div class="summary-section-label">Summary</div>
        <div class="summary-text">${data.summary}</div>
      </div>
      ${data.quick_summary ? `<div class="summary-card">
        <div class="summary-section-label">Quick summary</div>
        <div class="summary-text">${data.quick_summary}</div>
      </div>` : ""}
      <div class="summary-card">
        <div class="summary-section-label">Key topics</div>
        <div class="topic-pills">${topics}</div>
      </div>
    `;
  } catch { el.textContent = "Failed to generate summary."; }
}

// ─── Notes ────────────────────────────────────────────────────────────────────

async function generateNotes() {
  if (!currentUrl) return;
  const el = document.getElementById("notesContent");
  el.innerHTML = `<div class="typing-dots" style="margin:1rem 0"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;

  try {
    const res = await fetch(`${API_BASE}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();
    if (!res.ok) { el.textContent = `Error: ${data.detail}`; return; }

    notesData = data;
    document.getElementById("downloadNotesBtn").style.display = "inline-block";

    const bullets = (data.bullet_points || []).map(b => `<li>${b}</li>`).join("");
    const terms = (data.key_terms || []).map(t => `
      <div class="key-term-card">
        <div class="key-term-name">${t.term}</div>
        <div class="key-term-def">${t.definition}</div>
      </div>`).join("");
    const facts = (data.important_facts || []).map(f => `
      <div class="fact-item"><div class="fact-dot"></div>${f}</div>`).join("");

    el.innerHTML = `
      <div class="notes-section">
        <div class="notes-title">${data.title || "Study Notes"}</div>
        <div class="notes-summary">${data.summary || ""}</div>
      </div>
      ${bullets ? `<div class="notes-section">
        <div class="section-label">Key points</div>
        <ul class="bullet-list">${bullets}</ul>
      </div>` : ""}
      ${terms ? `<div class="notes-section">
        <div class="section-label">Key terms</div>
        <div class="key-terms-grid">${terms}</div>
      </div>` : ""}
      ${facts ? `<div class="notes-section">
        <div class="section-label">Important facts</div>
        <div class="facts-list">${facts}</div>
      </div>` : ""}
    `;
  } catch { el.textContent = "Failed to generate notes."; }
}

function downloadNotes() {
  if (!notesData) return;
  const lines = [
    `STUDY NOTES — ${notesData.title || "Video"}`,
    `\nSUMMARY\n${notesData.summary || ""}`,
    `\nKEY POINTS\n${(notesData.bullet_points || []).map((b,i) => `${i+1}. ${b}`).join("\n")}`,
    `\nKEY TERMS\n${(notesData.key_terms || []).map(t => `${t.term}: ${t.definition}`).join("\n")}`,
    `\nIMPORTANT FACTS\n${(notesData.important_facts || []).map((f,i) => `${i+1}. ${f}`).join("\n")}`,
  ].join("\n");

  const blob = new Blob([lines], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `notes-${currentVideoId}.txt`;
  a.click();
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

async function generateQuiz() {
  if (!currentUrl) return;
  const el = document.getElementById("quizContent");
  el.innerHTML = `<div class="typing-dots" style="margin:1rem 0"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  quizAnswers = {};

  try {
    const res = await fetch(`${API_BASE}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });
    const data = await res.json();
    if (!res.ok) { el.textContent = `Error: ${data.detail}`; return; }

    quizData = data.questions;
    renderQuiz(quizData, el);
  } catch { el.textContent = "Failed to generate quiz."; }
}

function renderQuiz(questions, el) {
  if (!questions || questions.length === 0) { el.textContent = "Could not generate quiz for this video."; return; }

  const html = questions.map((q, qi) => `
    <div class="quiz-question" id="quiz-q-${qi}">
      <div class="quiz-q-text">${qi + 1}. ${q.question}</div>
      <div class="quiz-options">
        ${q.options.map((opt, oi) => `
          <button class="quiz-option" onclick="selectAnswer(${qi}, ${oi}, ${q.correct})" id="quiz-opt-${qi}-${oi}">
            ${String.fromCharCode(65 + oi)}. ${opt}
          </button>
        `).join("")}
      </div>
    </div>
  `).join("");

  el.innerHTML = html + `<button class="btn-outline" style="margin-top:1rem" onclick="showQuizScore()">Submit quiz</button>`;
}

function selectAnswer(qi, oi, correct) {
  quizAnswers[qi] = oi;
  const opts = document.querySelectorAll(`[id^="quiz-opt-${qi}-"]`);
  opts.forEach(o => { o.classList.remove("correct","wrong"); o.disabled = true; });
  document.getElementById(`quiz-opt-${qi}-${oi}`).classList.add(oi === correct ? "correct" : "wrong");
  if (oi !== correct) document.getElementById(`quiz-opt-${qi}-${correct}`).classList.add("correct");
}

function showQuizScore() {
  if (!quizData) return;
  let score = 0;
  quizData.forEach((q, i) => { if (quizAnswers[i] === q.correct) score++; });
  const el = document.getElementById("quizContent");
  const scoreEl = document.createElement("div");
  scoreEl.className = "quiz-score";
  scoreEl.textContent = `Your score: ${score} / ${quizData.length}`;
  el.appendChild(scoreEl);
}

// ─── History ──────────────────────────────────────────────────────────────────

function renderHistory() {
  const el = document.getElementById("historyList");
  if (queryHistory.length === 0) { el.innerHTML = `<div class="placeholder-text">No queries yet.</div>`; return; }
  el.innerHTML = [...queryHistory].reverse().map((item, i) => `
    <div class="history-item">
      <div class="history-q">${queryHistory.length - i}. ${escapeHtml(item.question)}</div>
      <div class="history-a">${escapeHtml(item.answer)}</div>
      <div class="history-meta">${item.videoId} · ${item.time}</div>
    </div>
  `).join("");
}

function downloadHistory() {
  if (queryHistory.length === 0) { alert("No history to download."); return; }
  const text = queryHistory.map((item, i) =>
    `Q${i+1}: ${item.question}\nA: ${item.answer}\nTime: ${item.time}\n`
  ).join("\n---\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `history-${Date.now()}.txt`;
  a.click();
}

// ─── Voice Input ──────────────────────────────────────────────────────────────

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  recognition = new SR();
  recognition.lang = "en-IN";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let final = "", interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }
    const input = document.getElementById("questionInput");
    input.value = final || interim;
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (input.value.trim()) { stopListening(); askQuestion(); }
    }, 1500);
  };

  recognition.onerror = (e) => {
    stopListening();
    if (e.error === "not-allowed") appendBotMessage("Microphone access denied.");
  };
  recognition.onend = () => stopListening();
}

function toggleMic() {
  if (!recognition) { appendBotMessage("Voice input not supported. Use Chrome."); return; }
  isListening ? stopListening() : startListening();
}

function startListening() {
  if (!currentVideoId) { appendBotMessage("Please process a video first."); return; }
  isListening = true;
  document.getElementById("micBtn").classList.add("active");
  setTimeout(() => recognition.start(), 800);
}

function stopListening() {
  isListening = false;
  document.getElementById("micBtn").classList.remove("active");
  try { recognition.stop(); } catch {}
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Add this line:
  showPage('home', document.querySelector('.nav-btn'));
  
  document.getElementById("questionInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") askQuestion();
  });
  document.getElementById("videoUrl").addEventListener("keydown", (e) => {
    if (e.key === "Enter") processVideo();
  });
  initSpeechRecognition();
});