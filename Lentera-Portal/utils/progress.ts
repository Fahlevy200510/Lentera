"use client";

export interface StudentProgress {
  modules: {
    component_recognition: boolean;
    component_quiz?: boolean;
    series_circuit: boolean;
    parallel_circuit: boolean;
    circuit_troubleshoot?: boolean;
  };
  skills: {
    battery: number;
    cable: number;
    switch: number;
    flow: number;
    series: number;
    parallel: number;
  };
  xp: number;
  achievements: string[];
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  avatar: string;
}

export const DEFAULT_PROGRESS: StudentProgress = {
  modules: {
    component_recognition: false,
    component_quiz: false,
    series_circuit: false,
    parallel_circuit: false,
    circuit_troubleshoot: false,
  },
  skills: {
    battery: 1,
    cable: 1,
    switch: 1,
    flow: 1,
    series: 1,
    parallel: 0,
  },
  xp: 150,
  achievements: ["Percikan Terang"],
};

export const PRESET_STUDENTS: StudentProfile[] = [
  { id: "via", name: "Via", grade: "Siswa", avatar: "via" },
  { id: "amira", name: "Amira", grade: "Siswa", avatar: "amira" },
  { id: "luthfi", name: "Luthfi", grade: "Siswa", avatar: "luthfi" },
  { id: "guest", name: "Tamu / Juri Eksplorasi", grade: "Pengamat", avatar: "guest" },
];

const PRESET_INITIAL_PROGRESS: Record<string, StudentProgress> = {
  via: {
    modules: { component_recognition: true, series_circuit: true, parallel_circuit: false },
    skills: { battery: 5, cable: 5, switch: 4, flow: 4, series: 5, parallel: 1 },
    xp: 750,
    achievements: ["Cahaya Pertama", "Ahli Seri", "Percikan Terang"],
  },
  amira: {
    modules: { component_recognition: true, series_circuit: false, parallel_circuit: false },
    skills: { battery: 3, cable: 2, switch: 2, flow: 2, series: 1, parallel: 0 },
    xp: 250,
    achievements: ["Percikan Terang"],
  },
  luthfi: {
    modules: { component_recognition: true, series_circuit: false, parallel_circuit: false },
    skills: { battery: 5, cable: 4, switch: 4, flow: 2, series: 2, parallel: 0 },
    xp: 450,
    achievements: ["Cahaya Pertama", "Percikan Terang"],
  },
  ajib: {
    modules: { component_recognition: true, series_circuit: false, parallel_circuit: false },
    skills: { battery: 5, cable: 4, switch: 4, flow: 2, series: 2, parallel: 0 },
    xp: 450,
    achievements: ["Cahaya Pertama", "Percikan Terang"],
  },
  guest: {
    modules: { component_recognition: false, series_circuit: false, parallel_circuit: false },
    skills: { battery: 1, cable: 1, switch: 1, flow: 1, series: 0, parallel: 0 },
    xp: 50,
    achievements: [],
  },
};

const STUDENTS_LIST_KEY = "lentera_student_profiles";
const ACTIVE_STUDENT_KEY = "lentera_active_student";

export function getStudentProfiles(): StudentProfile[] {
  if (typeof window === "undefined") return PRESET_STUDENTS;
  try {
    const raw = localStorage.getItem(STUDENTS_LIST_KEY);
    if (!raw) {
      localStorage.setItem(STUDENTS_LIST_KEY, JSON.stringify(PRESET_STUDENTS));
      return PRESET_STUDENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Auto-migrate jika masih ada profil mockup lama atau label SMA
      const hasOldProfiles = parsed.some(
        (p: any) =>
          p.id === "ahmad" ||
          p.id === "siti" ||
          p.id === "dimas" ||
          p.id === "ajib" ||
          String(p.grade || "").toUpperCase().includes("SMA")
      );
      if (hasOldProfiles) {
        localStorage.setItem(STUDENTS_LIST_KEY, JSON.stringify(PRESET_STUDENTS));
        return PRESET_STUDENTS;
      }
      return parsed;
    }
    return PRESET_STUDENTS;
  } catch {
    return PRESET_STUDENTS;
  }
}

export function getActiveStudent(): StudentProfile {
  if (typeof window === "undefined") return PRESET_STUDENTS[0];
  try {
    const raw = localStorage.getItem(ACTIVE_STUDENT_KEY);
    if (!raw) {
      localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(PRESET_STUDENTS[0]));
      return PRESET_STUDENTS[0];
    }
    const parsed = JSON.parse(raw);
    if (parsed?.id === "ajib") {
      const luthfiProfile = PRESET_STUDENTS[2];
      localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(luthfiProfile));
      return luthfiProfile;
    }
    if (
      !parsed?.id ||
      parsed.id === "ahmad" ||
      parsed.id === "siti" ||
      parsed.id === "dimas"
    ) {
      localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(PRESET_STUDENTS[0]));
      return PRESET_STUDENTS[0];
    }
    if (String(parsed?.grade || "").toUpperCase().includes("SMA")) {
      parsed.grade = "Siswa";
      localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return PRESET_STUDENTS[0];
  }
}

export function setActiveStudent(student: StudentProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_STUDENT_KEY, JSON.stringify(student));
    // Simpan juga ke session auth untuk konsistensi login
    const currentSession = localStorage.getItem("lentera-session");
    let sessionObj: any = { role: "student" };
    try {
      if (currentSession) sessionObj = JSON.parse(currentSession);
    } catch {}
    sessionObj.name = student.name;
    sessionObj.grade = student.grade;
    localStorage.setItem("lentera-session", JSON.stringify(sessionObj));

    window.dispatchEvent(new CustomEvent("lentera-active-student-update", { detail: student }));
    window.dispatchEvent(new CustomEvent("lentera-auth-update", { detail: sessionObj }));
    window.dispatchEvent(new CustomEvent("lentera-progress-update", { detail: getStudentProgress(student.id) }));
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error("Gagal mengganti siswa aktif:", err);
  }
}

export function addStudentProfile(name: string, grade: string = "Siswa"): StudentProfile {
  const cleanName = name.trim();
  const id = `student_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString().slice(-4)}`;
  const newProfile: StudentProfile = {
    id,
    name: cleanName,
    grade,
    avatar: "user",
  };

  if (typeof window !== "undefined") {
    const profiles = getStudentProfiles();
    const updated = [...profiles, newProfile];
    localStorage.setItem(STUDENTS_LIST_KEY, JSON.stringify(updated));
    setActiveStudent(newProfile);
  }

  return newProfile;
}

export function getStudentProgress(studentId?: string): StudentProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;

  const targetId = studentId || getActiveStudent().id;
  const storageKey = `lentera_progress_${targetId}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      // Inisialisasi dari preset awal jika ada
      const initial = PRESET_INITIAL_PROGRESS[targetId] || DEFAULT_PROGRESS;
      localStorage.setItem(storageKey, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      modules: { ...DEFAULT_PROGRESS.modules, ...(parsed.modules || {}) },
      skills: { ...DEFAULT_PROGRESS.skills, ...(parsed.skills || {}) },
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : DEFAULT_PROGRESS.achievements,
    };
  } catch (err) {
    console.error(`Gagal membaca progress siswa (${targetId}):`, err);
    return DEFAULT_PROGRESS;
  }
}

export function saveStudentProgress(progress: StudentProgress, studentId?: string): void {
  if (typeof window === "undefined") return;
  const targetId = studentId || getActiveStudent().id;
  const storageKey = `lentera_progress_${targetId}`;

  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent("lentera-progress-update", { detail: progress }));
  } catch (err) {
    console.error(`Gagal menyimpan progress siswa (${targetId}):`, err);
  }
}

export function resetStudentProgress(studentId?: string): StudentProgress {
  const targetId = studentId || getActiveStudent().id;
  const freshProgress: StudentProgress = {
    modules: { component_recognition: false, series_circuit: false, parallel_circuit: false },
    skills: { battery: 1, cable: 1, switch: 1, flow: 1, series: 0, parallel: 0 },
    xp: 50,
    achievements: [],
  };
  saveStudentProgress(freshProgress, targetId);
  return freshProgress;
}

export function completeModule(
  moduleKey: "component_recognition" | "component_quiz" | "series_circuit" | "parallel_circuit" | "circuit_troubleshoot",
  studentId?: string
): StudentProgress {
  const current = getStudentProgress(studentId);
  const updated: StudentProgress = {
    ...current,
    modules: {
      ...current.modules,
      [moduleKey]: true,
    },
    skills: { ...current.skills },
    achievements: [...current.achievements],
  };

  if (moduleKey === "component_recognition") {
    // Pengenalan komponen tuntas: Kuasai baterai, kabel, saklar
    updated.skills.battery = 5;
    updated.skills.cable = 5;
    updated.skills.switch = 4;
    updated.skills.series = Math.max(updated.skills.series, 2);
    if (!updated.achievements.includes("Cahaya Pertama")) {
      updated.achievements.push("Cahaya Pertama");
    }
    updated.xp = Math.max(updated.xp, 500);
  } else if (moduleKey === "component_quiz") {
    // Kuis taktil tuntas: Detektif Taktil
    updated.skills.battery = 5;
    updated.skills.cable = 5;
    updated.skills.switch = 5;
    if (!updated.achievements.includes("Detektif Taktil")) {
      updated.achievements.push("Detektif Taktil");
    }
    updated.xp = Math.max(updated.xp, 650);
  } else if (moduleKey === "series_circuit") {
    // Rangkaian seri tuntas
    updated.skills.series = 5;
    updated.skills.flow = 4;
    updated.skills.parallel = Math.max(updated.skills.parallel, 1);
    if (!updated.achievements.includes("Ahli Seri")) {
      updated.achievements.push("Ahli Seri");
    }
    updated.xp = Math.max(updated.xp, 750);
  } else if (moduleKey === "parallel_circuit") {
    // Rangkaian paralel tuntas: Master Rangkaian
    updated.skills.parallel = 5;
    updated.skills.flow = 5;
    if (!updated.achievements.includes("Penjelajah Tegangan")) {
      updated.achievements.push("Penjelajah Tegangan");
    }
    if (!updated.achievements.includes("Master Rangkaian")) {
      updated.achievements.push("Master Rangkaian");
    }
    updated.xp = 1000;
  } else if (moduleKey === "circuit_troubleshoot") {
    // Tantangan Detektif Sirkuit tuntas: Master Detektif Sirkuit
    updated.skills.series = 5;
    updated.skills.parallel = 5;
    updated.skills.flow = 5;
    if (!updated.achievements.includes("Master Detektif Sirkuit")) {
      updated.achievements.push("Master Detektif Sirkuit");
    }
    if (!updated.achievements.includes("Tanpa Petunjuk")) {
      updated.achievements.push("Tanpa Petunjuk");
    }
    updated.xp = Math.max(updated.xp, 1200);
  }

  saveStudentProgress(updated, studentId);
  return updated;
}

/**
 * Mencatat keberhasilan merakit rangkaian secara live (baik di Tanya AI Tutor, Mode Eksplorasi Bebas, maupun papan fisik)
 * agar langsung ter-update ke progres siswa di LENTERA Learn & Rapor AI saat demo.
 */
export function recordLiveCircuitSuccess(
  graphType?: string,
  cells?: Record<string, any>,
  studentId?: string
): StudentProgress {
  const current = getStudentProgress(studentId);
  const lampCount = cells
    ? Object.values(cells).filter((c: any) => c && c.component === "lamp").length
    : 1;
  const isParallel = graphType === "parallel" || lampCount >= 2;

  const updated: StudentProgress = {
    ...current,
    modules: {
      ...current.modules,
      component_recognition: true,
      series_circuit: true,
      ...(isParallel ? { parallel_circuit: true } : {}),
    },
    skills: {
      battery: 5,
      cable: 5,
      switch: 5,
      flow: isParallel ? 5 : Math.max(current.skills.flow, 4),
      series: 5,
      parallel: isParallel ? 5 : Math.max(current.skills.parallel, 2),
    },
    xp: isParallel ? Math.max(current.xp + 200, 1000) : Math.max(current.xp + 150, 750),
    achievements: [...current.achievements],
  };

  for (const badge of ["Cahaya Pertama", "Ahli Seri"]) {
    if (!updated.achievements.includes(badge)) {
      updated.achievements.push(badge);
    }
  }
  if (isParallel) {
    for (const badge of ["Penjelajah Tegangan", "Master Rangkaian"]) {
      if (!updated.achievements.includes(badge)) {
        updated.achievements.push(badge);
      }
    }
  }

  saveStudentProgress(updated, studentId);
  return updated;
}

/**
 * Mencatat keaktifan siswa bertanya dan memecahkan masalah bersama AI Tutor di Lab
 */
export function recordAITutorInteraction(studentId?: string): StudentProgress {
  const current = getStudentProgress(studentId);
  const updated: StudentProgress = {
    ...current,
    modules: {
      ...current.modules,
      component_recognition: true,
      circuit_troubleshoot: true,
    },
    skills: {
      ...current.skills,
      battery: Math.max(current.skills.battery, 5),
      cable: Math.max(current.skills.cable, 5),
      switch: Math.max(current.skills.switch, 5),
      flow: Math.max(current.skills.flow, 4),
      series: Math.max(current.skills.series, 4),
    },
    xp: current.xp + 50,
    achievements: [...current.achievements],
  };

  if (!updated.achievements.includes("Tanpa Petunjuk")) {
    updated.achievements.push("Tanpa Petunjuk");
  }

  saveStudentProgress(updated, studentId);
  return updated;
}

export interface LearningNarration {
  shortOverview: string;
  fullReport: string;
  skillsNarration: string;
  modulesNarration: string;
}

export function buildStudentLearningNarration(
  student: StudentProfile,
  progress: StudentProgress
): LearningNarration {
  const name = student?.name || "Siswa";

  // Level & XP
  const xp = progress.xp;
  let levelTitle = "Level 1: Penjelajah";
  if (xp >= 1000) {
    levelTitle = "Level 3: Insinyur";
  } else if (xp >= 500) {
    levelTitle = "Level 2: Teknisi";
  }
  const xpPercent = Math.min(100, Math.round((xp / 1000) * 100));

  // Modules
  const modulesList = [
    { key: "component_recognition", name: "Tahap 1, Pengenalan Bentuk Taktil Komponen", done: Boolean(progress.modules.component_recognition) },
    { key: "component_quiz", name: "Tahap 2, Kuis Taktil", done: Boolean(progress.modules.component_quiz) },
    { key: "series_circuit", name: "Tahap 3, Rangkaian Listrik Seri", done: Boolean(progress.modules.series_circuit) },
    { key: "parallel_circuit", name: "Tahap 4, Rangkaian Listrik Paralel", done: Boolean(progress.modules.parallel_circuit) },
    { key: "circuit_troubleshoot", name: "Tahap 5, Tantangan Detektif Sirkuit Mahir", done: Boolean(progress.modules.circuit_troubleshoot) },
  ];

  const completedModules = modulesList.filter((m) => m.done);
  const uncompletedModules = modulesList.filter((m) => !m.done);
  const completedCount = completedModules.length;

  let modulesNarration = "";
  if (completedCount === 0) {
    modulesNarration = "Kamu belum menyelesaikan modul belajar. Mari kita mulai bersama dari Tahap 1, Pengenalan Bentuk Taktil Komponen di LENTERA Lab.";
  } else {
    const names = completedModules.map((m) => m.name).join(", ");
    const nextName = uncompletedModules[0]?.name;
    modulesNarration = `Kamu telah berhasil menuntaskan ${completedCount} dari 5 modul belajar, yaitu: ${names}. ${
      nextName ? `Langkah berikutnya yang siap kamu pelajari adalah ${nextName}.` : "Hebat sekali, seluruh modul telah berhasil kamu selesaikan!"
    }`;
  }

  // Skills
  const skillEntries = [
    { name: "Baterai", stars: progress.skills.battery },
    { name: "Kabel", stars: progress.skills.cable },
    { name: "Saklar", stars: progress.skills.switch },
    { name: "Aliran Arus", stars: progress.skills.flow },
    { name: "Rangkaian Seri", stars: progress.skills.series },
    { name: "Rangkaian Paralel", stars: progress.skills.parallel },
  ];

  const topSkills = skillEntries.filter((s) => s.stars >= 4).map((s) => s.name);
  let skillsNarration = `Penguasaan keterampilan komponenmu: Baterai ${progress.skills.battery} dari 5 bintang, Kabel ${progress.skills.cable} bintang, Saklar ${progress.skills.switch} bintang, Aliran Arus ${progress.skills.flow} bintang, Rangkaian Seri ${progress.skills.series} bintang, dan Rangkaian Paralel ${progress.skills.parallel} bintang.`;
  if (topSkills.length > 0) {
    skillsNarration += ` Kemampuan tertinggimu ada pada ${topSkills.join(" dan ")}, luar biasa!`;
  }

  // Achievements
  let achievementsNarration = "";
  if (progress.achievements.length === 0) {
    achievementsNarration = "Kamu belum mengoleksi lencana. Selesaikan modul di lab untuk membuka lencana pertamamu.";
  } else {
    achievementsNarration = `Kamu telah mengoleksi ${progress.achievements.length} lencana prestasi, di antaranya: ${progress.achievements.join(", ")}.`;
  }

  // Focus Lesson Today
  let lessonTitle = "Rangkaian Seri";
  let lessonDesc = "Hubungkan baterai ke saklar dan lampu dalam satu lintasan tertutup searah.";
  if (!progress.modules.component_recognition) {
    lessonTitle = "Pengenalan Komponen";
    lessonDesc = "Kenali bentuk taktil balok baterai, saklar, lampu, dan kabel di papan Lentera sebelum mulai merakit.";
  } else if (!progress.modules.series_circuit) {
    lessonTitle = "Rangkaian Seri";
    lessonDesc = "Hubungkan baterai ke saklar dan lampu dalam satu lintasan tertutup searah.";
  } else {
    lessonTitle = "Rangkaian Paralel";
    lessonDesc = "Gunakan kabel cabang Te untuk membagi aliran listrik ke dua lampu mandiri.";
  }

  // Short overview on enter
  const shortOverview = `Selamat datang di Dashboard LENTERA Learn, ${name}! Kamu berstatus ${levelTitle} dengan perolehan ${xp} XP. Pelajaran fokusmu hari ini adalah ${lessonTitle}. Letakkan balok di sel A1 untuk mendengarkan rincian progres belajarmu, sel E1 bagi Guru untuk membuka dan mendengarkan Laporan Analitik Kelas, sel C5 untuk membuka Rapor Evaluasi AI, atau sel E5 untuk mengakhiri sesi.`;

  // Full comprehensive report
  const fullReport = `Laporan data pembelajaran lengkap untuk ${name}. Pertama, ringkasan tingkatan: Kamu telah mengumpulkan ${xp} XP dan berada di ${levelTitle}, dengan progres ${xpPercent} persen menuju tingkatan berikutnya. Kedua, capaian modul: ${modulesNarration} Ketiga, peta penguasaan keterampilan: ${skillsNarration} Keempat, penghargaan dan pencapaian: ${achievementsNarration} Kelima, rekomendasi belajar hari ini adalah ${lessonTitle}: ${lessonDesc}. Letakkan balok di sel E1 jika Guru ingin mendengarkan Laporan Analitik Kelas, sel C5 untuk membuka Rapor Evaluasi AI, atau letakkan balok komponen di tengah papan untuk kembali merakit di LENTERA Lab.`;

  return {
    shortOverview,
    fullReport,
    skillsNarration,
    modulesNarration,
  };
}

export function computeStudentMasteryPercent(progress: StudentProgress): number {
  const completedMods = [
    progress.modules.component_recognition,
    progress.modules.component_quiz,
    progress.modules.series_circuit,
    progress.modules.parallel_circuit,
    progress.modules.circuit_troubleshoot,
  ].filter(Boolean).length;
  const skillSum =
    progress.skills.battery +
    progress.skills.cable +
    progress.skills.switch +
    progress.skills.flow +
    progress.skills.series +
    progress.skills.parallel; // max 30
  const xpScore = Math.min(progress.xp, 1000) / 1000; // 0..1
  const raw = Math.round(xpScore * 50 + (skillSum / 30) * 30 + completedMods * 4);
  if (progress.xp >= 1000) return Math.min(100, Math.max(88, raw));
  if (progress.xp >= 500) return Math.min(84, Math.max(62, raw));
  return Math.min(54, Math.max(32, raw));
}

export function buildTeacherClassNarration(teacherName: string = "Bapak atau Ibu Guru") {
  const viaProg = getStudentProgress("via");
  const amiraProg = getStudentProgress("amira");
  const luthfiProg = getStudentProgress("luthfi");
  const viaMastery = computeStudentMasteryPercent(viaProg);
  const amiraMastery = computeStudentMasteryPercent(amiraProg);
  const luthfiMastery = computeStudentMasteryPercent(luthfiProg);

  const allProgs = [viaProg, amiraProg, luthfiProg];
  const avgSkill = (key: keyof StudentProgress["skills"], base: number) => {
    const liveAvg = (allProgs.reduce((acc, p) => acc + p.skills[key] * 20, 0)) / allProgs.length;
    return Math.min(100, Math.round(liveAvg * 0.6 + base * 0.4));
  };
  const batVal = avgSkill("battery", 90);
  const cabVal = avgSkill("cable", 82);
  const swVal = avgSkill("switch", 76);
  const flowVal = avgSkill("flow", 54);
  const serVal = avgSkill("series", 63);
  const parVal = avgSkill("parallel", 38);

  const classMastery = Math.round((viaMastery + amiraMastery + luthfiMastery + 72 + 64 + 38) / 6);
  const seriesMasterCount = allProgs.filter((p) => p.modules.series_circuit).length + 1;

  const briefing = `Selamat datang di Dashboard Guru LENTERA Learn, ${teacherName}. Ringkasan kelas hari ini: 19 dari 24 siswa aktif praktikum dengan rata-rata penguasaan materi kelas mencapai ${classMastery} persen. Tekan tombol Analisis Kelas atau letakkan balok di sel A1 untuk mendengarkan rincian lengkap grafik kurva tren, profil radar keterampilan, dan status tiap siswa.`;

  const trendNarration = `Analisis Grafik Tren Penguasaan Kelas: Pemahaman siswa meningkat stabil selama 6 minggu terakhir. Dimulai dari 42 persen pada Minggu 1, 48 persen di Minggu 2, 55 persen di Minggu 3, 61 persen di Minggu 4, 65 persen di Minggu 5, dan kini mencapai ${classMastery} persen pada Minggu 6.`;

  const radarNarration = `Analisis Radar Profil Keterampilan Kelas: Penguasaan konsep Baterai berada di ${batVal} persen, Kabel ${cabVal} persen, Saklar ${swVal} persen, Rangkaian Seri ${serVal} persen, Aliran Arus ${flowVal} persen, dan Rangkaian Paralel ${parVal} persen.`;

  const insightsNarration = `Wawasan Diagnostik Cerdas Guru: Pertama, peringatan perangkat fisik pada terminal kanan papan. Kedua, konsep aliran arus berada di ${flowVal} persen. Ketiga, ${seriesMasterCount} siswa telah menguasai rangkaian seri dan siap membuka modul rangkaian paralel.`;

  const studentsNarration = `Laporan Capaian Individu Siswa Aktif: Via ${viaMastery} persen, Luthfi ${luthfiMastery} persen, dan Amira ${amiraMastery} persen. Siswa kelas lainnya: Lina 72 persen, Kai 64 persen, dan Bagas 38 persen.`;

  const fullAnalysis = `Laporan Lengkap Pembelajaran Kelas untuk ${teacherName}. Pertama, rata-rata penguasaan kelas saat ini mencapai ${classMastery} persen. Kedua, ${trendNarration} Ketiga, ${radarNarration} Keempat, ${studentsNarration} Kelima, ${insightsNarration} Untuk melihat dan mendengar Rapor Evaluasi AI per anak, letakkan kartu identitas siswa Via, Amira, atau Luthfi di sel C5, atau letakkan balok di sel A1 untuk kembali ke tampilan Progres Siswa.`;

  return {
    briefing,
    fullAnalysis,
    trendNarration,
    radarNarration,
    insightsNarration,
    studentsNarration,
  };
}
