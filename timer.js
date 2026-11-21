/* =========================================================
   js/timer.js
   Rest Timer Antar-Set dengan Notifikasi Audio Ringan
   ========================================================= */

const RestTimer = (() => {
  let defaultSeconds = 90;
  let remainingSeconds = 90;
  let intervalId = null;
  let isRunning = false;

  const els = {
    bar: () => document.getElementById("rest-timer-bar"),
    display: () => document.getElementById("timer-display"),
    toggleBtn: () => document.getElementById("timer-toggle-btn")
  };

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Abaikan jika browser memblokir audio otomatis
    }
  }

  function render() {
    const display = els.display();
    const toggleBtn = els.toggleBtn();
    if (display) display.textContent = formatTime(remainingSeconds);
    if (toggleBtn) toggleBtn.textContent = isRunning ? "Jeda" : "Mulai";
  }

  function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isRunning = false;
    render();
  }

  function start(customSeconds) {
    const bar = els.bar();
    if (bar) bar.classList.remove("hidden");

    if (typeof customSeconds === "number" && customSeconds > 0) {
      remainingSeconds = customSeconds;
    } else if (remainingSeconds <= 0) {
      remainingSeconds = defaultSeconds;
    }

    stopInterval();
    isRunning = true;
    render();

    intervalId = setInterval(() => {
      remainingSeconds -= 1;
      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        stopInterval();
        playBeep();
        if ("vibrate" in navigator) navigator.vibrate([180, 80, 180]);
      }
      render();
    }, 1000);
  }

  function toggle() {
    if (isRunning) {
      stopInterval();
    } else {
      start();
    }
  }

  function reset() {
    stopInterval();
    remainingSeconds = defaultSeconds;
    render();
  }

  function adjust(deltaSeconds) {
    remainingSeconds = Math.max(5, remainingSeconds + deltaSeconds);
    render();
  }

  function setDefaultDuration(seconds) {
    defaultSeconds = Math.max(15, Number(seconds) || 90);
    if (!isRunning) {
      remainingSeconds = defaultSeconds;
      render();
    }
  }

  function init(initialDuration) {
    setDefaultDuration(initialDuration);

    document.getElementById("timer-minus-btn")?.addEventListener("click", () => adjust(-15));
    document.getElementById("timer-plus-btn")?.addEventListener("click", () => adjust(15));
    document.getElementById("timer-toggle-btn")?.addEventListener("click", toggle);
    document.getElementById("timer-reset-btn")?.addEventListener("click", reset);
  }

  return {
    init,
    start,
    reset,
    setDefaultDuration
  };
})();
