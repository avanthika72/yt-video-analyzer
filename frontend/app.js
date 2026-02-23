const API_BASE = "http://127.0.0.1:8000";
let currentVideoId = null;

async function processVideo() {
  const url = document.getElementById("videoUrl").value.trim();
  const statusEl = document.getElementById("processStatus");
  const btn = document.getElementById("processBtn");

  if (!url) {
    statusEl.textContent = "⚠️ Please enter a YouTube URL.";
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "⏳ Processing video... this may take a moment.";

  try {
    const res = await fetch(`${API_BASE}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = `❌ Error: ${data.detail}`;
      return;
    }

    currentVideoId = data.video_id;
    statusEl.textContent = `✅ ${data.message}`;
    document.getElementById("chatSection").classList.remove("hidden");
    appendMessage("bot", "Video loaded! Ask me anything about it.");
  } catch (err) {
    statusEl.textContent = "❌ Could not connect to the backend. Is it running?";
  } finally {
    btn.disabled = false;
  }
}

async function askQuestion() {
  const input = document.getElementById("questionInput");
  const question = input.value.trim();
  if (!question || !currentVideoId) return;

  appendMessage("user", question);
  input.value = "";

  const loadingId = appendMessage("bot", "Thinking...", true);

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: currentVideoId, question }),
    });

    const data = await res.json();
    removeMessage(loadingId);

    if (!res.ok) {
      appendMessage("bot", `❌ ${data.detail}`);
      return;
    }

    appendMessage("bot", data.answer);
  } catch (err) {
    removeMessage(loadingId);
    appendMessage("bot", "❌ Request failed. Check backend connection.");
  }
}

function appendMessage(role, text, isLoading = false) {
  const chatBox = document.getElementById("chatBox");
  const div = document.createElement("div");
  const id = `msg-${Date.now()}`;
  div.id = id;
  div.className = `message ${role}${isLoading ? " loading" : ""}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}