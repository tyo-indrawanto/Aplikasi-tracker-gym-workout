/* =========================================================
   js/storage.js
   Manajemen Penyimpanan Lokal (IndexedDB + LocalStorage)
   & Ekspor/Impor JSON
   ========================================================= */

const StorageManager = (() => {
  const DB_NAME = "IronLogDB";
  const DB_VERSION = 1;
  const STORE_SETS = "workout_sets";

  const KEYS = {
    SETTINGS: "ironlog_settings_v1",
    EXERCISES: "ironlog_exercises_v1",
    FALLBACK_SETS: "ironlog_sets_fallback_v1"
  };

  const DEFAULT_SETTINGS = {
    goal: "bulking", // "bulking" | "cutting"
    unit: "kg",      // "kg" | "lbs"
    defaultRest: 90  // detik
  };

  const DEFAULT_EXERCISES = [
    "Bench Press (Barbell)",
    "Incline Dumbbell Press",
    "Overhead Press (OHP)",
    "Lateral Raise",
    "Lat Pulldown",
    "Barbell Row",
    "Back Squat",
    "Romanian Deadlift (RDL)",
    "Leg Press",
    "Bicep Curl",
    "Tricep Pushdown"
  ];

  let dbInstance = null;

  function openDB() {
    return new Promise((resolve) => {
      if (!("indexedDB" in window)) {
        resolve(null);
        return;
      }
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_SETS)) {
          const store = db.createObjectStore(STORE_SETS, { keyPath: "id" });
          store.createIndex("dateKey", "dateKey", { unique: false });
          store.createIndex("exercise", "exercise", { unique: false });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  // --- Pengaturan Program ---
  function getSettings() {
    try {
      const raw = localStorage.getItem(KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(newSettings) {
    const merged = { ...getSettings(), ...newSettings };
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
  }

  // --- Daftar Gerakan ---
  function getExercises() {
    try {
      const raw = localStorage.getItem(KEYS.EXERCISES);
      if (!raw) {
        localStorage.setItem(KEYS.EXERCISES, JSON.stringify(DEFAULT_EXERCISES));
        return [...DEFAULT_EXERCISES];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_EXERCISES];
    } catch {
      return [...DEFAULT_EXERCISES];
    }
  }

  function addExercise(name) {
    const clean = name.trim();
    if (!clean) return getExercises();

    const list = getExercises();
    const exists = list.some((item) => item.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      list.unshift(clean);
      localStorage.setItem(KEYS.EXERCISES, JSON.stringify(list));
    }
    return list;
  }

  // --- CRUD Set Latihan ---
  function getFallbackSets() {
    try {
      const raw = localStorage.getItem(KEYS.FALLBACK_SETS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveFallbackSets(sets) {
    localStorage.setItem(KEYS.FALLBACK_SETS, JSON.stringify(sets));
  }

  async function addSet(setEntry) {
    const db = await openDB();
    if (!db) {
      const all = getFallbackSets();
      all.push(setEntry);
      saveFallbackSets(all);
      return setEntry;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETS, "readwrite");
      tx.objectStore(STORE_SETS).put(setEntry);
      tx.oncomplete = () => resolve(setEntry);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function deleteSet(id) {
    const db = await openDB();
    if (!db) {
      const filtered = getFallbackSets().filter((item) => item.id !== id);
      saveFallbackSets(filtered);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETS, "readwrite");
      tx.objectStore(STORE_SETS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllSets() {
    const db = await openDB();
    if (!db) {
      return getFallbackSets().sort((a, b) => b.timestamp - a.timestamp);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETS, "readonly");
      const req = tx.objectStore(STORE_SETS).getAll();
      req.onsuccess = () => {
        const result = req.result || [];
        result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function replaceAllSets(setsArray) {
    const db = await openDB();
    if (!db) {
      saveFallbackSets(setsArray);
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETS, "readwrite");
      const store = tx.objectStore(STORE_SETS);
      store.clear();
      setsArray.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Ekspor & Impor JSON ---
  async function exportAllData() {
    const sets = await getAllSets();
    return {
      app: "IronLog",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      exercises: getExercises(),
      sets
    };
  }

  async function importAllData(payload) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.sets)) {
      throw new Error("Format file JSON tidak valid.");
    }

    if (payload.settings && typeof payload.settings === "object") {
      saveSettings(payload.settings);
    }

    if (Array.isArray(payload.exercises) && payload.exercises.length > 0) {
      localStorage.setItem(KEYS.EXERCISES, JSON.stringify(payload.exercises));
    }

    const sanitizedSets = payload.sets
      .filter((s) => s && s.exercise && Number(s.reps) > 0 && Number(s.weight) >= 0)
      .map((s) => ({
        id: s.id || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        dateKey: s.dateKey || new Date(s.timestamp || Date.now()).toISOString().slice(0, 10),
        timestamp: Number(s.timestamp) || Date.now(),
        exercise: String(s.exercise),
        weight: Number(s.weight),
        reps: Number(s.reps),
        note: s.note ? String(s.note) : ""
      }));

    await replaceAllSets(sanitizedSets);
    return sanitizedSets.length;
  }

  return {
    getSettings,
    saveSettings,
    getExercises,
    addExercise,
    addSet,
    deleteSet,
    getAllSets,
    exportAllData,
    importAllData
  };
})();
