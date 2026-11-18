import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/tutor
// Body: { message: string, mode?: string, circuitState?: object, history?: {role, text}[] }
// Returns: { text: string, note: string | null, mode: string }
//
// Dual-Engine Architecture:
// 1. Groq LLaMA 3.3 70B if GROQ_API_KEY is configured.
// 2. Intelligent CLE Deterministic Reasoning Fallback if offline/no key,
//    ensuring Netlify deployment and LIDM jury review never fails.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Kamu adalah LENTERA AI ASSISTANT — tutor lab sains yang adaptif dan inklusif untuk siswa tunanetra dan low vision, dikembangkan untuk LIDM 2026.

KONTEKS PERANGKAT KERAS PAPAN TAKTIL LENTERA (WAJIB DIPATUHI):
1. Papan Taktil 5×5 (A1–E5): Kolom A sampai E (kiri ke kanan) dan Baris 1 sampai 5 (Baris 1 paling dekat dengan tubuh siswa, Baris 5 paling jauh di depan siswa, C3 adalah titik tengah papan).
2. Balok Pasif Tanpa Listrik Nyata (Zero Electrical Hazard): Seluruh balok komponen dicetak 3D (PLA) dengan penanda ArUco di bagian bawah dan simbol timbul di bagian atas. Balok TIDAK dialiri arus listrik nyata dan TIDAK PERNAH menjadi hangat/panas. JANGAN PERNAH menyuruh siswa meraba apakah lampu terasa hangat. Status menyala/mati disampaikan melalui suara narator dan efek audio.
3. Enam Komponen Taktil & Cara Operasinya:
   - Baterai (battery): simbol timbul garis pendek tebal untuk kutub negatif (-) dan tanda tambah (+) untuk kutub positif.
   - Saklar (switch): berbentuk SAKLAR GESER dengan tuas geser timbul memanjang di bagian atas balok (BUKAN bundar/lingkaran; yang berbentuk bundar adalah kubah lampu). Digunakan untuk menyambung (ON) atau memutus (OFF) arus listrik dengan menggeser tuas / memutar balok saklar 90 derajat di kotaknya.
   - Lampu (lamp): simbol kubah/lingkaran bundar timbul di bagian tengah dengan tanda kutub (+) dan (-) di sisinya. Jika polaritasnya terbalik (polarity_reversed), siswa cukup memutar balok lampu 180 derajat.
   - Kabel Lurus (straight_cable): satu garis lurus timbul memanjang di tengah.
   - Kabel Belok / L (l_cable): garis timbul berbelok 90 derajat membentuk sudut siku-siku.
   - Kabel Simpang Tiga / T (t_cable): garis lurus dengan satu cabang di tengah membentuk huruf T untuk membagi arus pada rangkaian paralel.

PERAN & PRINSIP PEDAGOGIS:
1. "Jelaskan Sebelum Menjawab": Jangan memberi jawaban instan tanpa alasan; bimbing siswa secara singkat dan terarah.
2. Kosakata Taktil: JANGAN PERNAH memakai instruksi visual seperti "lihat gambar" atau "perhatikan warna kabel". Gunakan bahasa taktil seperti "raba", "rasakan tuas saklar geser", "telusuri alur kabel", dan "sisi kiri/kanan".
3. Bahasa & Panjang Jawaban (WAJIB SANGAT SINGKAT UNTUK DEMO): Selalu jawab dalam Bahasa Indonesia yang ramah, langsung ke inti, dan MAKSIMAL 1–2 KALIMAT PENDEK (maksimal 30 kata). Jangan mengulang daftar semua komponen di papan; fokus hanya pada komponen atau konsep yang ditanyakan.
4. Mode Interaksi:
   - Mode Eksplorasi: Mengenal komponen dan analogi taktil untuk aliran listrik.
   - Mode Pemecahan Masalah: Menelusuri kesalahan rangkaian secara sistematis menggunakan data sensor koordinat papan A1–E5.
   - Refleksi Konsep: Merenungkan mengapa suatu fenomena terjadi secara taktil dan logis.
   - Mode Evaluasi: Memberi pertanyaan taktil formatif untuk mengecek pemahaman mandiri.`;

interface ChatTurn {
  role: "ai" | "user";
  text: string;
}

// Normalises circuit telemetry so both schemas work:
//  - UI/simulator: { polarity_correct, circuit_closed, switch_state }
//  - legacy:       { isLampReversed, isSwitchOpen }
function normalizeCircuit(cs: any): { lampReversed: boolean; switchOpen: boolean; pathOpen: boolean; allGood: boolean } | null {
  if (!cs || typeof cs !== "object") return null;
  const status = String(cs.status || "");
  const lampReversed = cs.isLampReversed === true || cs.polarity_correct === false || status === "polarity_reversed";
  const switchOpen = cs.isSwitchOpen === true || cs.switch_state === "off" || status === "switch_off";
  const pathOpen = cs.circuit_closed === false || status === "open_circuit" || status === "not_connected";
  const allGood = !lampReversed && !switchOpen && !pathOpen && (cs.circuit_closed === true || cs.polarity_correct === true || status === "success");
  return { lampReversed, switchOpen, pathOpen, allGood };
}

const COMPONENT_NAME_ID: Record<string, string> = {
  battery: "Baterai",
  switch: "Saklar",
  lamp: "Lampu",
  straight_cable: "Kabel Lurus",
  l_cable: "Kabel Belok (L)",
  t_cable: "Kabel Simpang Tiga (T)",
  resistor: "Resistor",
};

function sanitizeCircuitCells(cs: any): Record<string, any> {
  if (!cs?.cells || typeof cs.cells !== "object") return {};
  const clean: Record<string, any> = {};
  for (const [pos, val] of Object.entries(cs.cells)) {
    if (!val || typeof val !== "object") continue;
    const comp = String((val as any).component || "");
    const id = Number((val as any).id || 0);
    // Abaikan kartu identitas siswa/guru (ID >= 30)
    if (comp.startsWith("student_") || comp.startsWith("teacher") || id >= 30) {
      continue;
    }
    clean[pos] = val;
  }
  return clean;
}

function findComponentCells(cs: any, compName: string): string[] {
  const cells = sanitizeCircuitCells(cs);
  return Object.entries(cells)
    .filter(([_, val]: [string, any]) => val && val.component === compName)
    .map(([pos]) => pos);
}

function summarizeBoardComponents(cs: any): string {
  const cells = sanitizeCircuitCells(cs);
  const entries = Object.entries(cells);
  if (entries.length === 0) {
    return "Papan saat ini KOSONG (belum ada balok komponen rangkaian yang terpasang).";
  }
  const items = entries.map(([pos, val]: [string, any]) => {
    const label = COMPONENT_NAME_ID[val.component] || val.component;
    if (val.component === "switch" && typeof val.is_on === "boolean") {
      return `${label} di kotak ${pos} (status: ${val.is_on ? "ON/Tertutup" : "OFF/Terbuka"})`;
    }
    return `${label} di kotak ${pos}`;
  });
  return `Total ${entries.length} komponen terpasang: ${items.join(", ")}.`;
}

// Intelligent Offline Fallback Engine
function generateCLEFallbackResponse(
  message: string,
  mode: string,
  circuitState?: any
): { text: string; note: string } {
  const m = message.toLowerCase();
  const cs = normalizeCircuit(circuitState);
  const switchCells = findComponentCells(circuitState, "switch");
  const lampCells = findComponentCells(circuitState, "lamp");

  // Kata kunci Indonesia + Inggris agar tetap kompatibel
  const isSeriesParallel = /seri|paralel|parallel/.test(m);

  if (/orang tua|parent/.test(m)) {
    if (isSeriesParallel) {
      return {
        text: "Gunakan analogi jalan: rangkaian seri seperti satu lorong lurus tanpa cabang, sedangkan paralel seperti jalan bercabang. Ajak siswa meraba alur kabel lurus lalu bercabang dan ceritakan bedanya.",
        note: "Panduan Orang Tua: Rangkaian Seri & Paralel",
      };
    }
    return {
      text: "Ajak siswa meraba alur kabel dan tuas saklar geser di papan Lentera, lalu tanyakan apa yang terjadi pada arus saat saklar dinyalakan atau dimatikan.",
      note: "Panduan Orang Tua: Aktivitas Taktil di Rumah",
    };
  }

  const isOtherIntent =
    mode === "reflection" || mode === "evaluation" ||
    /konsep|beda|kuis|tes|evaluasi|pertanyaan|apa itu|apa fungsi|fungsi|bagaimana|jelaskan|concept|difference|quiz|test|evaluation|question|what is|explain|seri|paralel|parallel/.test(m);
  const mentionsFault = /rusak|mati|tidak menyala|ga nyala|gak nyala|nggak nyala|tidak berfungsi|salah|error|redup|broken|dead|not working|wrong|dim/.test(m);
  const wantsDiagnosis = mode === "troubleshooting" || mentionsFault || !isOtherIntent;

  if (cs && wantsDiagnosis && (cs.lampReversed || cs.switchOpen || cs.pathOpen)) {
    if (cs.lampReversed) {
      const lampLoc = lampCells.length > 0 ? ` di kotak ${lampCells.join(" atau ")}` : "";
      return {
        text: `Jalur rangkaianmu sudah terhubung, tetapi kutub lampu LED${lampLoc} masih terbalik. Coba raba kubah bundar lampu${lampLoc} lalu putar 180 derajat agar tanda plus (+) menghadap arah kutub positif baterai.`,
        note: "Diagnosis CLE: Polaritas lampu terbalik",
      };
    }
    if (cs.switchOpen) {
      const switchLoc = switchCells.length > 0 ? ` di kotak ${switchCells.join(" atau ")}` : " di papanmu";
      return {
        text: `Susunan kabelmu sudah benar, tetapi saklar${switchLoc} masih posisi OFF. Raba tuas saklar geser${switchLoc}, lalu geser atau putar 90 derajat ke posisi ON agar arus mengalir.`,
        note: "Diagnosis CLE: Saklar terbuka (Rangkaian Terbuka)",
      };
    }
    return {
      text: "Jalur rangkaianmu masih terbuka. Coba telusuri alur garis timbul dari kutub positif baterai dari kotak ke kotak, apakah ada sambungan kabel yang belum bertemu?",
      note: "Diagnosis CLE: Jalur rangkaian terbuka",
    };
  }
  if (cs && !mentionsFault && wantsDiagnosis && cs.allGood && (mode === "troubleshooting" || /benar|selesai|nyala|menyala|berhasil|cek|periksa|correct|done|lit|working|check/.test(m))) {
    return {
      text: "Hebat, rangkaianmu sudah tertutup dan lampu menyala! Menurutmu, apa yang terjadi pada nyala lampu jika kita menambah satu lampu lagi secara seri?",
      note: "CLE: Rangkaian berhasil tertutup",
    };
  }

  if (mode === "troubleshooting" || mentionsFault) {
    return {
      text: "Mari kita cek bersama: telusuri alur kabel timbul dari kutub positif baterai menuju lampu. Adakah kotak yang kosong atau tuas saklar geser yang masih OFF?",
      note: "Diagnosis CLE: Penelusuran jalur taktil mandiri",
    };
  }

  if (mode === "reflection" || /kenapa|mengapa|konsep|beda|why|concept|difference/.test(m) || isSeriesParallel) {
    if (isSeriesParallel) {
      return {
        text: "Rangkaian seri mengalir dalam satu jalur tunggal sehingga jika satu lampu lepas, semuanya padam. Rangkaian paralel memiliki cabang terpisah, jadi jika satu cabang mati, apakah cabang lainnya tetap menyala?",
        note: "Refleksi Konsep: Analogi Jalur Taktil",
      };
    }
    return {
      text: "Arus listrik hanya mengalir pada rangkaian tertutup dari kutub positif baterai, melewati lampu, lalu kembali ke kutub negatif. Coba raba papanmu, apakah jalurnya sudah menyambung penuh?",
      note: "Refleksi Konsep: Loop Rangkaian Tertutup",
    };
  }

  if (mode === "evaluation" || /kuis|tes|evaluasi|pertanyaan|quiz|test|evaluation|question/.test(m)) {
    return {
      text: "Kuis Taktil: Jika 1 baterai dan 2 lampu disusun berurutan dalam satu jalur tanpa cabang, apakah itu rangkaian seri atau paralel?",
      note: "Evaluasi Formatif: Memahami Rangkaian Seri",
    };
  }

  if (/baterai|battery/.test(m)) {
    return {
      text: "Baterai adalah sumber energi listrik dengan simbol timbul tanda tambah (+) untuk kutub positif dan garis pendek (-) untuk kutub negatif. Arus mengalir keluar dari kutub positif menuju rangkaian.",
      note: "Eksplorasi Taktil: Mengenali Polaritas Baterai",
    };
  }

  if (/saklar|sakelar|switch/.test(m)) {
    return {
      text: "Balok saklar memiliki tuas saklar geser timbul di bagian atasnya (bukan bundar) untuk menyambung dan memutus arus listrik. Geser tuas atau putar balok saklar 90 derajat ke posisi ON untuk menyalakan lampu.",
      note: "Eksplorasi Taktil: Cara Kerja Balok Saklar",
    };
  }

  if (/lampu|cahaya|lamp|light/.test(m)) {
    return {
      text: "Balok lampu memiliki kubah bundar timbul di tengah serta tanda kutub (+) dan (-) di sisinya. Jika rangkaian sudah tertutup tetapi lampu belum menyala, putar balok lampu 180 derajat.",
      note: "Eksplorasi Taktil: Mengenali Beban Lampu",
    };
  }

  if (/kabel|cable|lurus|belok|cabang|simpang/.test(m)) {
    return {
      text: "Ada tiga balok kabel taktil: Kabel Lurus (garis lurus), Kabel L (belok siku 90 derajat), dan Kabel T (simpang tiga untuk membagi cabang paralel).",
      note: "Eksplorasi Taktil: Tiga Jenis Balok Kabel",
    };
  }

  return {
    text: "Halo! Aku LENTERA AI Assistant, siap membantumu merangkai di papan taktil 5 kali 5. Silakan raba komponenmu atau tanyakan apa saja!",
    note: "Dukungan Belajar Inklusif Aktif",
  };
}

function trimToConciseSentences(raw: string): string {
  const cleaned = raw
    .replace(/\*\*|__|\*|`/g, "")
    .replace(/^\s*[-•\d.)]+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const parts =
    cleaned
      .match(/[^.!?;]+[.!?;]+|[^.!?;]+$/g)
      ?.map((s) => s.trim().replace(/;$/, "."))
      .filter(Boolean) || [cleaned];
  if (parts.length <= 2) return parts.join(" ");
  const maxCount = parts[0].length <= 18 ? 3 : 2;
  return parts.slice(0, maxCount).join(" ").trim();
}

const ALLOWED_MODES = new Set(["exploration", "troubleshooting", "reflection", "evaluation"]);

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "LENTERA AI Tutor",
    engine: process.env.GROQ_API_KEY ? "groq-with-local-fallback" : "CLE-Rule-Engine-Local",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body?.message ?? "").trim();
    const requestedMode = String(body?.mode ?? "exploration");
    const mode = ALLOWED_MODES.has(requestedMode) ? requestedMode : "exploration";
    const circuitState = body?.circuitState ?? null;
    const history: ChatTurn[] = Array.isArray(body?.history)
      ? body.history
        .filter((h: any) => (h?.role === "user" || h?.role === "ai") && typeof h?.text === "string")
        .slice(-6)
      : [];

    if (!message) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }
    if (message.length > 1200) {
      return NextResponse.json({ error: "Pesan terlalu panjang. Maksimal 1.200 karakter." }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

    // If Groq API key is not present, use the deterministic CLE fallback
    if (!apiKey) {
      const fallback = generateCLEFallbackResponse(message, mode, circuitState);
      return NextResponse.json({
        text: fallback.text,
        note: fallback.note,
        mode,
        engine: "CLE-Rule-Engine-Local",
      });
    }

    // If Groq API key is provided, use LLaMA 3.3 70B
    let diagnosisRule = "";
    const sensorStatus = String(circuitState?.status || "");
    const switchCells = findComponentCells(circuitState, "switch");
    const lampCells = findComponentCells(circuitState, "lamp");
    if (sensorStatus === "polarity_reversed") {
      const lampLoc = lampCells.length > 0 ? ` di kotak ${lampCells.join(", ")}` : "";
      diagnosisRule = `\n\nATURAN MUTLAK DIAGNOSIS SENSOR: Status sirkuit polarity_reversed (kutub lampu LED${lampLoc} terbalik, sedangkan jalur kabel sudah tertutup). Jawab singkat 1–2 kalimat: beritahu bahwa jalur sudah tersambung tetapi kutub lampu${lampLoc} (berkubah bundar) terbalik, lalu minta siswa memutarnya 180 derajat.`;
    } else if (sensorStatus === "switch_off") {
      const switchLoc = switchCells.length > 0 ? ` di kotak ${switchCells.join(", ")}` : "";
      diagnosisRule = `\n\nATURAN MUTLAK DIAGNOSIS SENSOR: Rangkaian sudah tersambung tetapi balok saklar${switchLoc} masih OFF. Jawab singkat 1–2 kalimat: minta siswa meraba tuas saklar geser${switchLoc} (BUKAN bundar) lalu menggeser/memutarnya 90 derajat ke posisi ON.`;
    } else if (sensorStatus === "short_circuit") {
      diagnosisRule = "\n\nPERINGATAN BAHAYA SENSOR: Korsleting arus pendek tanpa beban lampu! Jawab singkat 1–2 kalimat: minta siswa segera melepas satu kabel atau memasang lampu.";
    } else if (sensorStatus === "no_battery") {
      diagnosisRule = "\n\nDIAGNOSIS SENSOR: Belum ada baterai di papan. Jawab singkat 1–2 kalimat: minta siswa memasang balok baterai (simbol timbul + dan -).";
    } else if (sensorStatus === "no_lamp") {
      diagnosisRule = "\n\nDIAGNOSIS SENSOR: Belum ada lampu di papan. Jawab singkat 1–2 kalimat: minta siswa memasang balok lampu (kubah bundar timbul di tengah).";
    } else if (sensorStatus === "success") {
      diagnosisRule = "\n\nSTATUS SENSOR: Rangkaian berhasil menyala! Berikan apresiasi dan tanggapan singkat 1–2 kalimat.";
    }

    const cleanCells = sanitizeCircuitCells(circuitState);
    const boardSummary = summarizeBoardComponents(circuitState);
    const sanitizedState = circuitState
      ? {
        ...circuitState,
        placedCount: Object.keys(cleanCells).length,
        cells: cleanCells,
      }
      : null;

    const brevityRule = `\n\nATURAN KETAT WAKTU DEMO (WAJIB): Jawab SANGAT SINGKAT dalam 1–2 kalimat pendek saja (maksimal 25–30 kata), tanpa titik koma (;), tanpa poin-poin, dan tanpa merinci ulang semua komponen di papan. Ingat: fisik saklar adalah SAKLAR GESER (tuas geser timbul di atas balok, BUKAN bundar; yang bundar hanya kubah lampu).`;

    const contextBlock = sanitizedState
      ? `\n\nDAFTAR PASTI KOMPONEN DI PAPAN SAAT INI (PATUHI 100%, JANGAN SEBUT KOMPONEN LAIN ATAU BALOK A1):\n${boardSummary}\n\nData sensor rangkaian fisik saat ini:\n${JSON.stringify(sanitizedState, null, 2)}\nMode saat ini: ${mode}${diagnosisRule}${brevityRule}`
      : `\n\nMode saat ini: ${mode}${brevityRule}`;

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}${contextBlock}` },
      ...history.slice(-6).map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.text,
      })),
      { role: "user", content: message },
    ];

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!groqRes.ok) {
        const errorText = await groqRes.text();

        console.error("GROQ API ERROR:", groqRes.status, errorText);

        const fallback = generateCLEFallbackResponse(
          message,
          mode,
          circuitState
        );

        return NextResponse.json({
          text: fallback.text,
          note: `Groq error ${groqRes.status} — memakai CLE cadangan`,
          mode,
          engine: "CLE-Rule-Engine-Local (Groq-Failover)",
          groqError: errorText,
        });
      }

      const data = await groqRes.json();
      const rawContent: string = data?.choices?.[0]?.message?.content?.trim() || "";
      const cleanContent = trimToConciseSentences(
        rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim()
      );
      const text: string =
        cleanContent ||
        generateCLEFallbackResponse(message, mode, circuitState).text;

      let note = `Mode: ${mode.toUpperCase()}`;
      if (circuitState) {
        if (circuitState.polarity_correct === false) note = "CLE: Polaritas Terbalik Terdeteksi";
        else if (circuitState.circuit_closed === false) note = "CLE: Jalur Rangkaian Terbuka";
        else if (circuitState.circuit_closed === true) note = "CLE: Rangkaian Berhasil Tertutup";
      }

      return NextResponse.json({ text, note, mode, engine: "Groq-LLaMA-3.3-70B" });
    } catch (apiErr) {
      // Failover safely
      const fallback = generateCLEFallbackResponse(message, mode, circuitState);
      return NextResponse.json({
        text: fallback.text,
        note: fallback.note,
        mode,
        engine: "CLE-Rule-Engine-Local (Exception-Failover)",
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
