/* =========================================================
   js/workout.js
   Logika Sesi Latihan, Auto-Fill Sesi Terakhir, & Riwayat
   ========================================================= */

const WorkoutController = (() => {
  let allSetsCache = [];

  function getTodayKey() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function formatDateID(dateKey) {
    const [y, m, d] = dateKey.split("-");
    const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${Number(d)} ${bulan[Number(m) - 1]} ${y}`;
  }

  function updateLiveMetricsPreview() {
    const settings = StorageManager.getSettings();
    const weight = Number(document.getElementById("weight-input")?.value) || 0;
    const reps = Number(document.getElementById("reps-input")?.value) || 0;

    const est1RM = MetricsCalculator.calculate1RM(weight, reps);
    const vol = MetricsCalculator.calculateVolume(weight, reps);

    const el1RM = document.getElementById("live-1rm-value");
    const elVol = document.getElementById("live-volume-value");

    if (el1RM) el1RM.textContent = `${est1RM} ${settings.unit}`;
    if (elVol) elVol.textContent = `${vol} ${settings.unit}`;
  }

  // Auto-Fill beban & repetisi dari performa terakhir gerakan yang dipilih
  function applyAutoFillForExercise(exerciseName) {
    const settings = StorageManager.getSettings();
    const refTextEl = document.getElementById("last-session-text");
    const weightInput = document.getElementById("weight-input");
    const repsInput = document.getElementById("reps-input");

    const matching = allSetsCache.filter(
      (s) => s.exercise.toLowerCase() === exerciseName.toLowerCase()
    );

    if (matching.length === 0) {
      if (refTextEl) refTextEl.textContent = "Belum ada riwayat untuk gerakan ini.";
      if (weightInput) weightInput.value = "";
      if (repsInput) repsInput.value = "";
      updateLiveMetricsPreview();
      return;
    }

    const latest = matching[0]; // sudah terurut terbaru
    const est1RM = MetricsCalculator.calculate1RM(latest.weight, latest.reps);

    if (refTextEl) {
      refTextEl.textContent = `${latest.weight} ${settings.unit} × ${latest.reps} reps (Est. 1RM: ${est1RM} ${settings.unit}) — ${formatDateID(latest.dateKey)}`;
    }

    if (weightInput) weightInput.value = latest.weight;
    if (repsInput) repsInput.value = latest.reps;
    updateLiveMetricsPreview();
  }

  function renderExerciseOptions(selectedName) {
    const exercises = StorageManager.getExercises();
    const workoutSelect = document.getElementById("exercise-select");
    const historyFilter = document.getElementById("history-filter-select");

    if (workoutSelect) {
      workoutSelect.innerHTML = exercises
        .map((ex) => `<option value="${escapeHtml(ex)}">${escapeHtml(ex)}</option>`)
        .join("");

      if (selectedName && exercises.includes(selectedName)) {
        workoutSelect.value = selectedName;
      }
      applyAutoFillForExercise(workoutSelect.value);
    }

    if (historyFilter) {
      const prevVal = historyFilter.value || "ALL";
      historyFilter.innerHTML =
        `<option value="ALL">Semua Gerakan</option>` +
        exercises
          .map((ex) => `<option value="${escapeHtml(ex)}">${escapeHtml(ex)}</option>`)
          .join("");
      historyFilter.value = exercises.includes(prevVal) ? prevVal : "ALL";
    }
  }

  function renderTodaySets() {
    const settings = StorageManager.getSettings();
    const todayKey = getTodayKey();
    const todaySets = allSetsCache.filter((s) => s.dateKey === todayKey);

    const listEl = document.getElementById("today-sets-list");
    const badgeEl = document.getElementById("today-summary-badge");

    if (badgeEl) badgeEl.textContent = `${todaySets.length} Set`;
    if (!listEl) return;

    if (todaySets.length === 0) {
      listEl.innerHTML = `<li class="empty-state">Belum ada set tercatat hari ini.</li>`;
      return;
    }

    listEl.innerHTML = todaySets
      .map((s) => {
        const est1RM = MetricsCalculator.calculate1RM(s.weight, s.reps);
        const noteHtml = s.note ? `<span class="set-note">"${escapeHtml(s.note)}"</span>` : "";
        return `
          <li class="set-item">
            <div class="set-main">
              <span class="set-exercise">${escapeHtml(s.exercise)}</span>
              <span class="set-detail">${s.weight} ${settings.unit} × ${s.reps} reps • Est. 1RM: ${est1RM} ${settings.unit}</span>
              ${noteHtml}
            </div>
            <button type="button" class="btn-delete-set" data-delete-id="${s.id}">Hapus</button>
          </li>
        `;
      })
      .join("");
  }

  function renderHistoryAndStats() {
    const settings = StorageManager.getSettings();
    const filterVal = document.getElementById("history-filter-select")?.value || "ALL";

    const filteredSets =
      filterVal === "ALL"
        ? allSetsCache
        : allSetsCache.filter((s) => s.exercise === filterVal);

    // Update 3 kotak metrik atas
    const summary = MetricsCalculator.analyzeSets(filteredSets, settings.goal, settings.unit);
    document.getElementById("stat-best-1rm").textContent = summary.best1RM;
    document.getElementById("stat-max-weight").textContent = summary.maxWeight;
    document.getElementById("stat-mode-label").textContent = summary.modeLabel;
    document.getElementById("stat-mode-value").textContent = summary.modeValue;

    const container = document.getElementById("history-list");
    if (!container) return;

    if (filteredSets.length === 0) {
      container.innerHTML = `<p class="empty-state">Belum ada riwayat sesi tersimpan.</p>`;
      return;
    }

    // Kelompokkan per tanggal
    const grouped = {};
    filteredSets.forEach((s) => {
      if (!grouped[s.dateKey]) grouped[s.dateKey] = [];
      grouped[s.dateKey].push(s);
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

    container.innerHTML = sortedDates
      .map((dateKey) => {
        const items = grouped[dateKey];
        const rows = items
          .map((s) => {
            const est1RM = MetricsCalculator.calculate1RM(s.weight, s.reps);
            const noteLine = s.note ? `<div class="set-note">Catatan: ${escapeHtml(s.note)}</div>` : "";
            return `
              <div class="set-item" style="margin-bottom:6px;">
                <div class="set-main">
                  <span class="set-exercise">${escapeHtml(s.exercise)}</span>
                  <span class="set-detail">${s.weight} ${settings.unit} × ${s.reps} reps • 1RM: ${est1RM} ${settings.unit}</span>
                  ${noteLine}
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="history-day-group">
            <div class="history-date">
              <span>${formatDateID(dateKey)}</span>
              <span>${items.length} Set</span>
            </div>
            ${rows}
          </div>
        `;
      })
      .join("");
  }

  async function refreshAllData(preserveSelectedExercise = true) {
    allSetsCache = await StorageManager.getAllSets();
    const currentEx = preserveSelectedExercise
      ? document.getElementById("exercise-select")?.value
      : null;

    renderExerciseOptions(currentEx);
    renderTodaySets();
    renderHistoryAndStats();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function init(showToast) {
    const exerciseSelect = document.getElementById("exercise-select");
    const toggleAddBtn = document.getElementById("toggle-add-exercise-btn");
    const addBox = document.getElementById("add-exercise-box");
    const saveExBtn = document.getElementById("save-exercise-btn");
    const newExInput = document.getElementById("new-exercise-input");
    const setForm = document.getElementById("set-form");
    const weightInput = document.getElementById("weight-input");
    const repsInput = document.getElementById("reps-input");
    const todayList = document.getElementById("today-sets-list");
    const historyFilter = document.getElementById("history-filter-select");

    exerciseSelect?.addEventListener("change", (e) => {
      applyAutoFillForExercise(e.target.value);
    });

    toggleAddBtn?.addEventListener("click", () => {
      addBox?.classList.toggle("hidden");
      if (!addBox?.classList.contains("hidden")) newExInput?.focus();
    });

    saveExBtn?.addEventListener("click", () => {
      const val = newExInput?.value.trim();
      if (!val) return;
      StorageManager.addExercise(val);
      newExInput.value = "";
      addBox?.classList.add("hidden");
      renderExerciseOptions(val);
      showToast(`Gerakan "${val}" ditambahkan`);
    });

    // Tombol Stepper (- / +) untuk beban & reps
    document.querySelectorAll(".btn-step").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const step = Number(btn.getAttribute("data-step")) || 0;
        const input = document.getElementById(targetId);
        if (!input) return;

        const current = Number(input.value) || 0;
        const minVal = targetId === "reps-input" ? 1 : 0;
        const next = Math.max(minVal, Number((current + step).toFixed(2)));
        input.value = next;
        updateLiveMetricsPreview();
      });
    });

    weightInput?.addEventListener("input", updateLiveMetricsPreview);
    repsInput?.addEventListener("input", updateLiveMetricsPreview);

    // Simpan Set Baru
    setForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const exercise = exerciseSelect?.value;
      const weight = Number(weightInput?.value);
      const reps = Number(repsInput?.value);
      const note = document.getElementById("set-note-input")?.value.trim() || "";

      if (!exercise || isNaN(weight) || weight < 0 || !reps || reps < 1) {
        showToast("Isi beban dan repetisi dengan benar.");
        return;
      }

      const entry = {
        id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dateKey: getTodayKey(),
        timestamp: Date.now(),
        exercise,
        weight,
        reps,
        note
      };

      await StorageManager.addSet(entry);
      document.getElementById("set-note-input").value = "";

      const settings = StorageManager.getSettings();
      RestTimer.start(settings.defaultRest);

      await refreshAllData(true);
      showToast("Set tersimpan! Timer istirahat dimulai.");
    });

    // Hapus Set dari Daftar Hari Ini
    todayList?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-delete-id]");
      if (!btn) return;
      const id = btn.getAttribute("data-delete-id");
      await StorageManager.deleteSet(id);
      await refreshAllData(true);
      showToast("Set dihapus.");
    });

    // Filter Tab Riwayat
    historyFilter?.addEventListener("change", () => {
      renderHistoryAndStats();
    });
  }

  return {
    init,
    refreshAllData
  };
})();
