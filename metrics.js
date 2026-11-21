/* =========================================================
   js/metrics.js
   Kalkulasi Estimasi 1RM, Volume, & Analisis Bulking vs Cutting
   ========================================================= */

const MetricsCalculator = (() => {
  // Rumus Epley: 1RM = weight * (1 + reps / 30)
  function calculate1RM(weight, reps) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    return Number((w * (1 + r / 30)).toFixed(1));
  }

  function calculateVolume(weight, reps) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    return Number((w * r).toFixed(1));
  }

  function analyzeSets(sets, goal, unit) {
    if (!sets || sets.length === 0) {
      return {
        best1RM: "-",
        maxWeight: "-",
        modeLabel: goal === "bulking" ? "Tren Volume" : "Retensi Kekuatan",
        modeValue: "-"
      };
    }

    let best1RM = 0;
    let maxWeight = 0;

    sets.forEach((s) => {
      const est = calculate1RM(s.weight, s.reps);
      if (est > best1RM) best1RM = est;
      if (s.weight > maxWeight) maxWeight = s.weight;
    });

    // Kelompokkan per tanggal (terbaru ke terlama)
    const byDate = {};
    sets.forEach((s) => {
      if (!byDate[s.dateKey]) byDate[s.dateKey] = [];
      byDate[s.dateKey].push(s);
    });

    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

    if (goal === "bulking") {
      // Fokus Bulking: bandingkan total volume sesi terbaru vs sesi sebelumnya
      const latestVol = byDate[dates[0]].reduce(
        (acc, s) => acc + calculateVolume(s.weight, s.reps),
        0
      );

      if (dates.length < 2) {
        return {
          best1RM: `${best1RM} ${unit}`,
          maxWeight: `${maxWeight} ${unit}`,
          modeLabel: "Volume Terbaru",
          modeValue: `${Math.round(latestVol)} ${unit}`
        };
      }

      const prevVol = byDate[dates[1]].reduce(
        (acc, s) => acc + calculateVolume(s.weight, s.reps),
        0
      );

      const diff = prevVol > 0 ? (((latestVol - prevVol) / prevVol) * 100).toFixed(1) : 0;
      const sign = Number(diff) > 0 ? "+" : "";

      return {
        best1RM: `${best1RM} ${unit}`,
        maxWeight: `${maxWeight} ${unit}`,
        modeLabel: "Tren Volume",
        modeValue: `${sign}${diff}%`
      };
    } else {
      // Fokus Cutting: cek retensi 1RM terbaik sesi terbaru dibanding rekor terbaik
      const latestBest1RM = Math.max(
        ...byDate[dates[0]].map((s) => calculate1RM(s.weight, s.reps))
      );
      const retentionPct = best1RM > 0 ? Math.round((latestBest1RM / best1RM) * 100) : 100;

      return {
        best1RM: `${best1RM} ${unit}`,
        maxWeight: `${maxWeight} ${unit}`,
        modeLabel: "Retensi Kekuatan",
        modeValue: `${retentionPct}%`
      };
    }
  }

  return {
    calculate1RM,
    calculateVolume,
    analyzeSets
  };
})();
