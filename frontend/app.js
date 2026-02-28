const API_BASE = "http://127.0.0.1:8000";
let currentVideoId = null;
let messageCounter = 0; // use incrementing counter instead of timestamp for unique IDs

async function processVideo() {
  const url = document.getElementById("videoUrl").value.trim();
  const statusEl = document.getElementById("processStatus");
  const btn = document.getElementById("processBtn");

  if (!url) {
    statusEl.textContent = "⚠️ Please enter a YouTube URL.";
    return;
  }

  if (btn.disabled) return; // prevent double submission

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

    const chatSection = document.getElementById("chatSection");
    const chatBox = document.getElementById("chatBox");

    // only show welcome message if chat is being opened fresh
    if (chatSection.classList.contains("hidden")) {
      chatSection.classList.remove("hidden");
      chatBox.innerHTML = ""; // clear previous chat if re-processing
      appendMessage("bot", "Video loaded! Ask me anything about it.");
    }

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

  input.value = "";
  input.disabled = true;

  const userMsgId = appendMessage("user", question); // save ID
  const loadingId = appendMessage("bot", "Thinking...", true);

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: currentVideoId, question }),
    });

    const data = await res.json();
    removeMessage(loadingId); // only remove loading bubble, not user message

    if (!res.ok) {
      appendMessage("bot", `❌ ${data.detail}`);
      return;
    }

    appendMessage("bot", data.answer);
  } catch (err) {
    removeMessage(loadingId);
    appendMessage("bot", "❌ Request failed. Check backend connection.");
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function appendMessage(role, text, isLoading = false) {
  const chatBox = document.getElementById("chatBox");
  const div = document.createElement("div");
  const id = `msg-${++messageCounter}`; // unique incrementing ID
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

// attach Enter key listener properly after DOM loads
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("questionInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") askQuestion();
  });
});