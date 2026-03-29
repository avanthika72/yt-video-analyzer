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
    chatSection.classList.remove("hidden");
    chatBox.innerHTML = ""; // always clear chat when new video is processed
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

// ─── Voice Input (Speech to Text) ────────────────────────────────────────────

let recognition = null;
let isListening = false;

function initSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    // browser doesn't support Web Speech API
    const micBtn = document.getElementById("micBtn");
    if (micBtn) {
      micBtn.disabled = true;
      micBtn.title = "Voice input not supported in this browser";
      const note = document.createElement("div");
      note.className = "mic-unsupported";
      note.textContent = "⚠️ Voice input not supported. Use Chrome or Edge.";
      micBtn.parentElement.appendChild(note);
    }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  // when speech is recognized — fill input and auto submit
  let silenceTimer = null;
  
  recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const input = document.getElementById("questionInput");
    input.value = finalTranscript || interimTranscript;

    // reset silence timer on every new word detected
    if (silenceTimer) clearTimeout(silenceTimer);

    // wait 1.5 seconds of silence after last word before submitting
    silenceTimer = setTimeout(() => {
      if (input.value.trim()) {
        stopListening();
        askQuestion();
      }
    }, 1500);
  };

    const input = document.getElementById("questionInput");
    // show interim results in real time while speaking
    input.value = finalTranscript || interimTranscript;

    // only submit when final transcript is ready
    if (finalTranscript) {
      stopListening();
      askQuestion();
    }
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    stopListening();
    if (event.error === "not-allowed") {
      appendMessage("bot", "⚠️ Microphone access denied. Please allow mic access in your browser settings.");
    }
  };

  recognition.onend = () => {
    stopListening();
  };

function toggleMic() {
  if (!recognition) {
    appendMessage("bot", "⚠️ Voice input not supported. Please use Chrome or Edge.");
    return;
  }
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
}

function startListening() {
  if (!currentVideoId) {
    appendMessage("bot", "⚠️ Please process a video first before using voice input.");
    return;
  }
  isListening = true;
  const micBtn = document.getElementById("micBtn");
  micBtn.classList.add("listening");
  micBtn.title = "Listening... click to stop";
  setTimeout(() => {
    recognition.start();
  }, 800);
}

function stopListening() {
  isListening = false;
  const micBtn = document.getElementById("micBtn");
  micBtn.classList.remove("listening");
  micBtn.title = "Voice input";
  try { recognition.stop(); } catch (e) {}
}

// initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("questionInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") askQuestion();
  });
  initSpeechRecognition();
});