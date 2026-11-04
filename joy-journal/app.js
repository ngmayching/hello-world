(() => {
  "use strict";

  const STORAGE_KEY = "joy-journal.v1";
  const SHARE_MIN_HEARTS = 4;
  const THREADS_INTENT = "https://www.threads.net/intent/post?text=";
  const HEART_LABELS = ["", "A little smile", "Nice!", "Really good", "So joyful!", "Pure bliss!"];

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("joy-form"), text: $("joy-text"), mic: $("mic-btn"), micStatus: $("mic-status"),
    picker: $("heart-picker"), heartLabel: $("heart-label"), save: $("save-btn"), count: $("char-count"),
    history: $("history"), toast: $("toast"),
    statToday: $("stat-today"), statStreak: $("stat-streak"), statAvg: $("stat-avg"), statPosted: $("stat-posted"),
    dialog: $("share-dialog"), shareText: $("share-text"), shareHearts: $("share-hearts"), shareCount: $("share-count"),
    exportBtn: $("export-btn"), importFile: $("import-file"),
  };

  /* ---------- Storage ---------- */
  let joys = load();
  let hearts = 0;
  let filter = "all";

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data.filter(isValidJoy) : [];
    } catch { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(joys)); }
    catch { toast("Couldn't save — storage is unavailable in this browser."); }
  }
  function isValidJoy(j) {
    return j && typeof j.id === "string" && typeof j.text === "string" &&
      Number.isInteger(j.hearts) && j.hearts >= 1 && j.hearts <= 5 && typeof j.createdAt === "string";
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  /* ---------- Heart picker ---------- */
  function buildPicker() {
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "heart-btn";
      b.textContent = "♥";
      b.dataset.value = i;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", `${i} heart${i > 1 ? "s" : ""}`);
      b.addEventListener("click", () => setHearts(i));
      b.addEventListener("mouseenter", () => paintHearts(i));
      b.addEventListener("mouseleave", () => paintHearts(hearts));
      b.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setHearts(Math.min(5, (hearts || 0) + 1), true); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setHearts(Math.max(1, (hearts || 2) - 1), true); }
      });
      els.picker.appendChild(b);
    }
    paintHearts(0);
  }
  function setHearts(n, focus) {
    hearts = n;
    paintHearts(n);
    if (focus) els.picker.children[n - 1].focus();
    updateSaveState();
  }
  function paintHearts(n) {
    [...els.picker.children].forEach((b, i) => {
      const v = i + 1;
      b.classList.toggle("on", v <= n);
      b.setAttribute("aria-checked", String(v === hearts));
      b.tabIndex = (hearts ? v === hearts : v === 1) ? 0 : -1;
    });
    els.heartLabel.textContent = n ? HEART_LABELS[n] : "Tap to score";
  }

  /* ---------- Form ---------- */
  function updateSaveState() {
    const len = els.text.value.length;
    els.count.textContent = `${len} / 500`;
    els.save.disabled = !(els.text.value.trim() && hearts);
  }
  els.text.addEventListener("input", updateSaveState);

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = els.text.value.trim();
    if (!text || !hearts) return;
    stopListening();
    const joy = {
      id: uid(), text, hearts,
      source: lastInputWasVoice ? "voice" : "text",
      createdAt: new Date().toISOString(),
      postedAt: null,
    };
    joys.unshift(joy);
    persist();
    els.text.value = "";
    lastInputWasVoice = false;
    setHearts(0);
    render();
    if (joy.hearts >= SHARE_MIN_HEARTS) openShare(joy);
    else toast("Joy saved ♥");
  });

  /* ---------- Voice input (Web Speech API) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, listening = false, baseText = "", lastInputWasVoice = false;

  if (!SR) {
    els.mic.disabled = true;
    els.mic.title = "Voice input isn't supported in this browser";
    els.micStatus.textContent = "Voice input isn't supported in this browser — try Chrome, Edge or Safari.";
  } else {
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (e) => {
      let finalText = "", interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      const spoken = (finalText + interim).trim();
      els.text.value = (baseText ? baseText + " " : "") + spoken;
      lastInputWasVoice = true;
      updateSaveState();
    };
    recognition.onerror = (e) => {
      const msg = {
        "not-allowed": "Microphone access was blocked. Allow it in your browser settings.",
        "service-not-allowed": "Microphone access was blocked. Allow it in your browser settings.",
        "no-speech": "Didn't catch that — try again.",
        "audio-capture": "No microphone found.",
        "network": "Voice recognition needs an internet connection.",
      }[e.error] || "Voice input stopped.";
      els.micStatus.textContent = msg;
    };
    recognition.onend = () => {
      listening = false;
      els.mic.setAttribute("aria-pressed", "false");
      els.mic.setAttribute("aria-label", "Record by voice");
      if (els.micStatus.textContent === "Listening… tap the mic to stop.") els.micStatus.textContent = "";
    };

    els.mic.addEventListener("click", () => (listening ? stopListening() : startListening()));
  }

  function startListening() {
    if (!recognition || listening) return;
    baseText = els.text.value.trim();
    try {
      recognition.start();
      listening = true;
      els.mic.setAttribute("aria-pressed", "true");
      els.mic.setAttribute("aria-label", "Stop recording");
      els.micStatus.textContent = "Listening… tap the mic to stop.";
    } catch { /* already started */ }
  }
  function stopListening() {
    if (recognition && listening) recognition.stop();
  }

  /* ---------- Threads sharing ---------- */
  let shareTarget = null;

  function defaultPostText(joy) {
    return `${joy.text}\n\n${"♥".repeat(joy.hearts)} #JoyJournal #DailyJoy`;
  }
  function openShare(joy) {
    shareTarget = joy;
    els.shareHearts.textContent = `${"♥".repeat(joy.hearts)} (${joy.hearts}/5)`;
    els.shareText.value = defaultPostText(joy);
    updateShareCount();
    if (typeof els.dialog.showModal === "function") {
      els.dialog.returnValue = "";
      els.dialog.showModal();
      els.shareText.focus();
    } else if (confirm(`Share this joy on Threads?\n\n${els.shareText.value}`)) {
      postToThreads(joy, els.shareText.value);
    }
  }
  function updateShareCount() {
    els.shareCount.textContent = `${els.shareText.value.length} / 500`;
  }
  els.shareText.addEventListener("input", updateShareCount);

  els.dialog.addEventListener("close", () => {
    const joy = shareTarget;
    shareTarget = null;
    if (!joy) return;
    if (els.dialog.returnValue === "confirm") {
      postToThreads(joy, els.shareText.value.trim() || defaultPostText(joy));
    } else {
      toast("Joy saved ♥ — you can share it later.");
    }
  });

  function postToThreads(joy, text) {
    // Threads' web intent opens a pre-filled composer; the user taps Post there.
    const url = THREADS_INTENT + encodeURIComponent(text);
    const win = window.open(url, "_blank");
    if (win) win.opener = null;
    else location.href = url; // popup blocked → navigate instead
    joy.postedAt = new Date().toISOString();
    persist();
    render();
    toast("Opened Threads — tap Post to share ✨");
  }

  /* ---------- Rendering ---------- */
  function dayKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function dayLabel(key) {
    const today = dayKey(new Date().toISOString());
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (key === today) return "Today";
    if (key === dayKey(y.toISOString())) return "Yesterday";
    const [yy, mm, dd] = key.split("-").map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  }

  function render() {
    renderStats();
    const list = joys.filter((j) =>
      filter === "high" ? j.hearts >= SHARE_MIN_HEARTS :
      filter === "unshared" ? j.hearts >= SHARE_MIN_HEARTS && !j.postedAt : true);

    els.history.replaceChildren();
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      const big = document.createElement("span");
      big.className = "big"; big.textContent = "🌱";
      empty.append(big, document.createTextNode(
        joys.length ? "Nothing here for this filter." : "No joys yet. What made you smile today?"));
      els.history.appendChild(empty);
      return;
    }

    const groups = new Map();
    for (const j of list) {
      const k = dayKey(j.createdAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(j);
    }
    for (const [k, items] of groups) {
      const g = document.createElement("div");
      g.className = "day-group";
      const h = document.createElement("h3");
      h.textContent = dayLabel(k);
      g.appendChild(h);
      items.forEach((j) => g.appendChild(renderJoy(j)));
      els.history.appendChild(g);
    }
  }

  function renderJoy(j) {
    const card = document.createElement("article");
    card.className = "joy";

    const top = document.createElement("div");
    top.className = "joy-top";
    const hs = document.createElement("span");
    hs.className = "joy-hearts";
    hs.setAttribute("aria-label", `${j.hearts} of 5 hearts`);
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement("span");
      s.textContent = "♥";
      if (i > j.hearts) s.className = "off";
      hs.appendChild(s);
    }
    const time = document.createElement("span");
    time.className = "joy-time";
    time.textContent = (j.source === "voice" ? "🎙 " : "") +
      new Date(j.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    top.append(hs, time);

    const p = document.createElement("p");
    p.className = "joy-text";
    p.textContent = j.text;

    const actions = document.createElement("div");
    actions.className = "joy-actions";
    if (j.hearts >= SHARE_MIN_HEARTS) {
      if (j.postedAt) {
        const b = document.createElement("span");
        b.className = "badge"; b.textContent = "Shared to Threads";
        actions.appendChild(b);
      }
      const share = document.createElement("button");
      share.type = "button";
      share.className = "link-btn share";
      share.textContent = j.postedAt ? "Share again" : "Share to Threads";
      share.addEventListener("click", () => openShare(j));
      actions.appendChild(share);
    }
    const del = document.createElement("button");
    del.type = "button";
    del.className = "link-btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this joy?")) return;
      joys = joys.filter((x) => x.id !== j.id);
      persist(); render(); toast("Deleted");
    });
    actions.appendChild(del);

    card.append(top, p, actions);
    return card;
  }

  function renderStats() {
    const today = dayKey(new Date().toISOString());
    els.statToday.textContent = joys.filter((j) => dayKey(j.createdAt) === today).length;
    els.statAvg.textContent = joys.length
      ? (joys.reduce((s, j) => s + j.hearts, 0) / joys.length).toFixed(1) : "–";
    els.statPosted.textContent = joys.filter((j) => j.postedAt).length;

    // Streak: consecutive days with at least one joy, ending today (or yesterday).
    const days = new Set(joys.map((j) => dayKey(j.createdAt)));
    const d = new Date();
    if (!days.has(dayKey(d.toISOString()))) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (days.has(dayKey(d.toISOString()))) { streak++; d.setDate(d.getDate() - 1); }
    els.statStreak.textContent = streak;
  }

  /* ---------- Filters ---------- */
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => {
      filter = c.dataset.filter;
      document.querySelectorAll(".chip").forEach((x) => x.classList.toggle("active", x === c));
      render();
    }));

  /* ---------- Export / import ---------- */
  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(joys, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `joy-journal-${dayKey(new Date().toISOString())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error();
      const known = new Set(joys.map((j) => j.id));
      const added = data.filter((j) => isValidJoy(j) && !known.has(j.id));
      joys = [...joys, ...added].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      persist(); render();
      toast(`Imported ${added.length} joy${added.length === 1 ? "" : "s"}`);
    } catch { toast("That file isn't a Joy Journal export."); }
    els.importFile.value = "";
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  buildPicker();
  updateSaveState();
  render();
})();
