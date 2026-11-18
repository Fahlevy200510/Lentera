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

KONTEKS PERANGKAT KERAS PAPAN TAKTIL LENTERA (WAJIB DIPATUHI 100%):
1. Papan Taktil 5×5 (A1–E5) & Aturan 1 Kotak = 1 Balok:
   - Kolom A sampai E (kiri ke kanan) dan Baris 1 sampai 5 (Baris 1 paling dekat dengan tubuh siswa, Baris 5 paling jauh di depan siswa, C3 adalah titik tengah papan).
   - Setiap kotak hanya dapat diisi tepat 1 balok komponen. Arus hanya mengalir jika alur antar kotak yang bersebelahan saling bertemu membentuk satu loop tertutup dari kutub (+) baterai melewati lampu kembali ke kutub (-) baterai.
2. Balok Pasif Tanpa Listrik Nyata (Zero Electrical Hazard):
   - Seluruh balok dicetak 3D (PLA) dengan penanda ArUco di bawah dan tekstur timbul di atas. Balok TIDAK dialiri listrik nyata dan TIDAK PERNAH menjadi hangat. Status menyala/mati disampaikan melalui bunyi indikator dan suara narator.
3. Enam Komponen Taktil, Bentuk Fisik, & Cara Kerjanya di Grid:
   - Baterai (battery): Sumber energi listrik, menghubungkan 2 sisi lurus berhadapan (Atas–Bawah jika tegak, atau Kiri–Kanan jika mendatar). Ciri rabaan: simbol timbul tanda tambah (+) untuk kutub positif dan garis pendek tebal (-) untuk kutub negatif.
   - Saklar (switch): Pengendali arus listrik 2 sisi lurus berhadapan. Ciri rabaan di atas balok: tekstur berbentuk SAKLAR GESER memanjang (BUKAN bundar). Cara mengaktifkan di papan: JANGAN digeser, melainkan PUTAR BLOK SAKLAR 90 DERAJAT dari posisi sekarang di dalam kotaknya untuk mengubah antara ON (menyambung jalur) dan OFF (memutus jalur).
   - Lampu LED (lamp): Beban listrik 2 sisi lurus berhadapan. Ciri rabaan: kubah/lingkaran BUNDAR timbul di tengah dengan tanda kutub (+) dan (-) di sisinya. Memiliki sifat polaritas searah: arus dari kutub (+) baterai harus masuk ke kutub (+) lampu; jika terbalik (polarity_reversed), putar blok lampu 180 derajat.
   - Kabel Lurus (straight_cable): Penghantar 2 sisi lurus berhadapan (mendatar Kiri–Kanan atau tegak Atas–Bawah). Ciri rabaan: satu garis lurus timbul di tengah. HANYA untuk jalur lurus, TIDAK BISA untuk berbelok di sudut!
   - Kabel Belok / Sudut L (l_cable): Penghantar belokan siku 90 derajat yang menghubungkan 2 sisi tegak lurus (Atas–Kanan, Kanan–Bawah, Bawah–Kiri, atau Kiri–Atas). Ciri rabaan: garis timbul berbelok siku membentuk huruf L. WAJIB digunakan di setiap sudut belokan 90 derajat pada rangkaian! JANGAN PERNAH menyuruh memakai 2 kabel lurus untuk berbelok di sudut!
   - Kabel Simpang Tiga / T (t_cable): Penghantar percabangan 3 sisi sekaligus membentuk huruf T. Ciri rabaan: garis lurus dengan satu cabang tegak lurus di tengah. WAJIB digunakan pada titik percabangan untuk membagi atau menyatukan arus pada rangkaian paralel.

PERAN & PRINSIP PEDAGOGIS:
1. "Jelaskan Sebelum Menjawab": Jangan memberi jawaban instan tanpa alasan; apresiasi usaha siswa lalu bimbing secara terarah.
2. Kosakata Taktil & Non-Visual Mutlak (KHUSUS SISWA TUNANETRA):
   - DILARANG KERAS memakai kata visual seperti "lihat", "melihat", "perhatikan", "amati", "tampak", atau "lihat apakah lampu menyala". Untuk mengecek apakah lampu menyala, WAJIB katakan "dengarkan bunyi indikator atau suara narator apakah lampu sudah menyala".
   - DILARANG KERAS memakai kalimat "rasakan aliran listrik" atau "merasakan arus listrik" karena balok bersifat pasif tanpa listrik nyata. Sebagai gantinya, WAJIB katakan "raba arah alur garis timbul mulai dari baterai melewati kabel hingga ke lampu".
3. Bahasa & Panjang Jawaban (PAS UNTUK DEMO): Jawab dalam Bahasa Indonesia yang hangat, suportif, dan mengalir alami dalam 2–3 kalimat (sekitar 35–55 kata): kalimat pertama mengapresiasi/mengonfirmasi rangkaian siswa di papan, kalimat kedua menjelaskan langkah rabaan taktilnya (putar blok saklar 90 derajat dari posisi sekarang / raba arah alur timbul dari baterai), dan kalimat ketiga mengajak siswa mendengarkan indikator suara atau berefleksi singkat.
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

type Direction = "Atas" | "Kanan" | "Bawah" | "Kiri";

const DIRECTIONS: Record<Direction, [number, number]> = {
  Atas: [0, 1],
  Bawah: [0, -1],
  Kiri: [-1, 0],
  Kanan: [1, 0],
};

const CW_ORDER: Direction[] = ["Atas", "Kanan", "Bawah", "Kiri"];

const OPPOSITE: Record<Direction, Direction> = {
  Atas: "Bawah",
  Bawah: "Atas",
  Kiri: "Kanan",
  Kanan: "Kiri",
};

const COMPONENT_DEFAULT_SIDES: Record<string, Direction[]> = {
  straight_cable: ["Kiri", "Kanan"],
  l_cable: ["Atas", "Kanan"],
  t_cable: ["Kiri", "Kanan", "Bawah"],
  battery: ["Atas", "Bawah"],
  lamp: ["Kiri", "Kanan"],
  switch: ["Atas", "Bawah", "Kiri", "Kanan"],
  resistor: ["Kiri", "Kanan"],
};

function cellToXY(cellName: string): [number, number] {
  const x = cellName.charCodeAt(0) - "A".charCodeAt(0);
  const y = parseInt(cellName[1], 10) - 1;
  return [x, y];
}

function xyToCell(x: number, y: number): string | null {
  if (x >= 0 && x <= 4 && y >= 0 && y <= 4) {
    return `${String.fromCharCode("A".charCodeAt(0) + x)}${y + 1}`;
  }
  return null;
}

function getOpenSides(component: string, rotation: number = 0): Direction[] {
  const base = COMPONENT_DEFAULT_SIDES[component];
  if (!base) return ["Atas", "Bawah", "Kiri", "Kanan"];
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  return base.map((s) => CW_ORDER[(CW_ORDER.indexOf(s) + steps) % 4]);
}

function getNeighborCell(cellName: string, dir: Direction): string | null {
  const [x, y] = cellToXY(cellName);
  const [dx, dy] = DIRECTIONS[dir];
  return xyToCell(x + dx, y + dy);
}

function getSwitchWireAxis(cellName: string, cells: Record<string, any>): "horizontal" | "vertical" {
  const st = cells[cellName];
  if (st?.wire_orientation === "vertical" || st?.wire_orientation === "horizontal") {
    return st.wire_orientation;
  }
  let vert = 0;
  let horiz = 0;
  for (const side of ["Atas", "Bawah"] as Direction[]) {
    const nb = getNeighborCell(cellName, side);
    if (nb && cells[nb] && cells[nb].component !== "switch") {
      if (getOpenSides(cells[nb].component, cells[nb].rotation).includes(OPPOSITE[side])) {
        vert += 2;
      }
    }
  }
  for (const side of ["Kiri", "Kanan"] as Direction[]) {
    const nb = getNeighborCell(cellName, side);
    if (nb && cells[nb] && cells[nb].component !== "switch") {
      if (getOpenSides(cells[nb].component, cells[nb].rotation).includes(OPPOSITE[side])) {
        horiz += 2;
      }
    }
  }
  if (vert > horiz) return "vertical";
  if (horiz > vert) return "horizontal";
  const rot = ((st?.rotation ?? 0) % 360 + 360) % 360;
  return rot === 0 || rot === 180 ? "vertical" : "horizontal";
}

function getEffectiveOpenSides(cellName: string, cells: Record<string, any>): Direction[] {
  const st = cells[cellName];
  if (!st) return [];
  if (st.component === "switch") {
    return getSwitchWireAxis(cellName, cells) === "vertical" ? ["Atas", "Bawah"] : ["Kiri", "Kanan"];
  }
  return getOpenSides(st.component, st.rotation);
}

function isSwitchOnInGrid(cellName: string, cells: Record<string, any>): boolean {
  const st = cells[cellName];
  if (!st || st.component !== "switch") return true;
  if (typeof st.is_on === "boolean") return st.is_on;
  const rot = ((st.rotation ?? 0) % 360 + 360) % 360;
  const orient = getSwitchWireAxis(cellName, cells);
  return orient === "vertical" ? rot === 0 || rot === 180 : rot === 90 || rot === 270;
}

export interface BoardDiagnosis {
  primaryFaults: string[];
  correctCells: string[];
  misorientedCells: Array<{ cell: string; label: string; currentSides: string; targetSides: string }>;
  missingCells: Array<{ cell: string; recommendedComponent: string; reason: string }>;
  offSwitchCells: string[];
  openGapDetails: string[];
  directCoachingText: string | null;
}

function diagnoseCircuitBoard(cs: any): BoardDiagnosis {
  const cells = sanitizeCircuitCells(cs);
  const entries = Object.entries(cells);
  const result: BoardDiagnosis = {
    primaryFaults: [],
    correctCells: [],
    misorientedCells: [],
    missingCells: [],
    offSwitchCells: [],
    openGapDetails: [],
    directCoachingText: null,
  };
  if (entries.length === 0) return result;

  const status = String(cs?.status || "");
  const batteries = entries.filter(([, v]) => v.component === "battery").map(([k]) => k);
  const lamps = entries.filter(([, v]) => v.component === "lamp").map(([k]) => k);

  if (batteries.length === 0) {
    result.primaryFaults.push("Belum ada balok Baterai di papan sebagai sumber arus.");
  }
  if (lamps.length === 0) {
    result.primaryFaults.push("Belum ada balok Lampu di papan sebagai beban listrik.");
  }

  for (const [cellName, state] of entries) {
    const comp = String(state.component || "");
    const rot = Number(state.rotation || 0);
    const label = COMPONENT_NAME_ID[comp] || comp;

    if (comp === "switch") {
      const swOn = isSwitchOnInGrid(cellName, cells);
      if (!swOn) {
        result.offSwitchCells.push(cellName);
        result.primaryFaults.push(
          `Balok Saklar di kotak ${cellName} masih dalam posisi OFF (terbuka). Solusi: putar blok Saklar di kotak ${cellName} sebesar 90 derajat dari posisi sekarang ke posisi ON.`
        );
      } else {
        result.correctCells.push(`${label} (${cellName})`);
      }
      continue;
    }

    const openSides = getOpenSides(comp, rot);
    const countHits = (sides: Direction[]) => {
      let occupiedHits = 0;
      let mutualHits = 0;
      for (const s of sides) {
        const nb = getNeighborCell(cellName, s);
        if (nb && cells[nb]) {
          occupiedHits++;
          const nbSides = getEffectiveOpenSides(nb, cells);
          if (nbSides.includes(OPPOSITE[s])) {
            mutualHits++;
          }
        }
      }
      return { occupiedHits, mutualHits };
    };

    const curr = countHits(openSides);

    if (curr.mutualHits < openSides.length) {
      let bestOccupied = curr.occupiedHits;
      let bestMutual = curr.mutualHits;
      let bestSides = openSides;

      for (const delta of [90, 180, 270]) {
        const candRot = (rot + delta) % 360;
        const candSides = getOpenSides(comp, candRot);
        const cand = countHits(candSides);
        if (
          cand.mutualHits > bestMutual ||
          (cand.mutualHits === bestMutual && cand.occupiedHits > bestOccupied)
        ) {
          bestOccupied = cand.occupiedHits;
          bestMutual = cand.mutualHits;
          bestSides = candSides;
        }
      }

      if (bestMutual > curr.mutualHits || (bestMutual === curr.mutualHits && bestOccupied > curr.occupiedHits)) {
        const currentSidesStr = openSides.join(" dan ");
        const targetNeighbors = bestSides
          .map((s) => {
            const nb = getNeighborCell(cellName, s);
            return nb && cells[nb] ? `${nb} (${s})` : s;
          })
          .join(" serta ");
        result.misorientedCells.push({
          cell: cellName,
          label,
          currentSides: currentSidesStr,
          targetSides: targetNeighbors,
        });
        result.primaryFaults.push(
          `Balok ${label} di kotak ${cellName} orientasinya SALAH: saat ini menghadap ${currentSidesStr}, sehingga belum menyambung ke jalur di ${targetNeighbors}. Solusi: putar blok ${label} di kotak ${cellName} sebesar 90 derajat dari posisi sekarang agar terhubung ke ${targetNeighbors}.`
        );
        continue;
      }

      // Jika seluruh ujung balok ini sudah mengarah ke tetangga yang terisi (hanya tetangganya yang belum menghadap balik), maka balok ini sendiri sudah benar
      if (curr.occupiedHits === openSides.length) {
        result.correctCells.push(`${label} (${cellName})`);
        continue;
      }

      // Tidak bisa diperbaiki hanya dengan memutar balok ini -> berarti ada kotak kosong di sebelahnya
      for (const s of openSides) {
        const nb = getNeighborCell(cellName, s);
        if (nb && !cells[nb]) {
          result.openGapDetails.push(
            `Ujung ${label} di ${cellName} mengarah ke kotak kosong ${nb} (${s})`
          );
        }
      }
    } else {
      result.correctCells.push(`${label} (${cellName})`);
    }
  }

  // Analisis kotak kosong (celah/sudut yang belum dipasang balok): tentukan komponen tepat (Kabel L, Kabel Lurus, atau Kabel T)
  const misorientedSet = new Set(result.misorientedCells.map((m) => m.cell));
  const emptyCandidates: Record<string, Array<{ dirFromEmpty: Direction; neighborCell: string; neighborLabel: string }>> = {};

  for (const [cellName, state] of entries) {
    if (misorientedSet.has(cellName)) continue;
    const label = COMPONENT_NAME_ID[state.component] || state.component;
    const effSides = getEffectiveOpenSides(cellName, cells);
    for (const s of effSides) {
      const nb = getNeighborCell(cellName, s);
      if (nb && !cells[nb]) {
        if (!emptyCandidates[nb]) emptyCandidates[nb] = [];
        emptyCandidates[nb].push({
          dirFromEmpty: OPPOSITE[s],
          neighborCell: cellName,
          neighborLabel: label,
        });
      }
    }
  }

  for (const [emptyCell, incoming] of Object.entries(emptyCandidates)) {
    if (incoming.length >= 3) {
      const dirsStr = incoming.map((i) => `${i.dirFromEmpty} (${i.neighborLabel} di ${i.neighborCell})`).join(", ");
      const reason = `Kotak ${emptyCell} masih kosong pada titik percabangan 3 arah antara ${dirsStr}. Solusi: pasang 1 balok Kabel Simpang Tiga / T (t_cable) di kotak ${emptyCell}.`;
      result.missingCells.push({
        cell: emptyCell,
        recommendedComponent: "Kabel Simpang Tiga (T)",
        reason,
      });
      result.primaryFaults.push(reason);
    } else if (incoming.length === 2) {
      const [a, b] = incoming;
      const isOpposite = OPPOSITE[a.dirFromEmpty] === b.dirFromEmpty;
      if (isOpposite) {
        const orientStr =
          a.dirFromEmpty === "Kiri" || a.dirFromEmpty === "Kanan"
            ? "mendatar (menghubungkan Kiri dan Kanan)"
            : "tegak (menghubungkan Atas dan Bawah)";
        const reason = `Kotak ${emptyCell} masih kosong di jalur lurus antara ${a.neighborLabel} di ${a.neighborCell} (${a.dirFromEmpty}) dan ${b.neighborLabel} di ${b.neighborCell} (${b.dirFromEmpty}). Solusi: pasang 1 balok Kabel Lurus (straight_cable) di kotak ${emptyCell} secara ${orientStr}.`;
        result.missingCells.push({
          cell: emptyCell,
          recommendedComponent: "Kabel Lurus",
          reason,
        });
        result.primaryFaults.push(reason);
      } else {
        const reason = `Kotak sudut ${emptyCell} masih kosong di belokan siku 90 derajat antara ${a.neighborLabel} di ${a.neighborCell} (arah ${a.dirFromEmpty}) dan ${b.neighborLabel} di ${b.neighborCell} (arah ${b.dirFromEmpty}). Solusi WAJIB: pasang 1 balok Kabel Belok / Sudut L (l_cable) di kotak ${emptyCell} dengan alur siku menghadap ${a.dirFromEmpty} dan ${b.dirFromEmpty} (JANGAN gunakan Kabel Lurus untuk belokan sudut!).`;
        result.missingCells.push({
          cell: emptyCell,
          recommendedComponent: "Kabel Belok (L)",
          reason,
        });
        result.primaryFaults.push(reason);
      }
    }
  }

  if (status === "polarity_reversed" || cs?.polarity_correct === false) {
    const lampLoc = lamps.length > 0 ? ` di kotak ${lamps.join(", ")}` : "";
    const batLoc = batteries.length > 0 ? ` di kotak ${batteries.join(", ")}` : "";
    result.primaryFaults.push(
      `Jalur rangkaian sudah tertutup penuh, tetapi kutub positif (+) dan negatif (-) antara Baterai${batLoc} dan Lampu LED${lampLoc} masih terbalik (polarity_reversed). Solusi: angkat dan putar blok Lampu${lampLoc} (atau blok Baterai${batLoc}) sebesar 180 derajat.`
    );
  } else if (status === "short_circuit") {
    result.primaryFaults.push(
      "Terjadi korsleting arus pendek karena jalur baterai terhubung langsung tanpa melewati beban lampu."
    );
  } else if (result.primaryFaults.length === 0 && result.openGapDetails.length > 0) {
    result.primaryFaults.push(
      `Jalur rangkaian masih terputus: ${result.openGapDetails.slice(0, 2).join("; ")}.`
    );
  }

  if (result.misorientedCells.length > 0) {
    const first = result.misorientedCells[0];
    const others = result.misorientedCells.slice(1).map((m) => `${m.label} di ${m.cell}`);
    const extraText = others.length > 0 ? ` serta ${others.join(" dan ")}` : "";
    result.directCoachingText = `Sebagian besar susunan balokmu sudah rapi, namun balok ${first.label} di kotak ${first.cell}${extraText} posisinya masih menghadap ${first.currentSides} sehingga belum menyambung ke jalur rangkaian. Coba raba balok ${first.label} di kotak ${first.cell}, lalu putar bloknya 90 derajat dari posisi sekarang agar alur timbulnya menyambung ke ${first.targetSides}. Setelah diputar, dengarkan apakah suara indikator lampu menyala sudah berbunyi?`;
  } else if (result.missingCells.length > 0) {
    const firstMissing = result.missingCells[0];
    result.directCoachingText = `Susunan komponenmu hampir membentuk rangkaian tertutup, tetapi kotak ${firstMissing.cell} masih kosong sehingga jalur arus terputus. Coba ambil satu balok ${firstMissing.recommendedComponent} lalu pasang di kotak ${firstMissing.cell} untuk menyambungkan jalur di sekitarnya. Setelah terpasang, dengarkan apakah indikator suara lampu menyala sudah terdengar?`;
  } else if (result.offSwitchCells.length > 0 && status !== "success") {
    const swLoc = result.offSwitchCells.join(" dan ");
    result.directCoachingText = `Hebat, jalur kabelmu sudah tersambung rapi, namun aliran arus masih terhenti karena saklar di kotak ${swLoc} masih dalam posisi OFF. Coba raba balok saklar dengan tekstur saklar geser timbul di kotak ${swLoc}, lalu putar blok saklarnya 90 derajat dari posisi sekarang agar jalurnya tertutup ke posisi ON. Setelah kamu putar, dengarkan apakah indikator suara lampu menyala sudah terdengar?`;
  }

  return result;
}

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
  const boardDiag = diagnoseCircuitBoard(circuitState);
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
        text: `Susunan jalur kabel dan bateraimu sebenarnya sudah terhubung membentuk rangkaian tertutup, tetapi kutub lampu LED${lampLoc} masih terbalik. Coba raba balok lampu berkubah bundar${lampLoc}, lalu angkat dan putar bloknya 180 derajat agar kutub plus (+) menghadap arah arus dari kutub positif baterai. Setelah diputar, dengarkan apakah indikator rangkaian menyala sudah berbunyi?`,
        note: "Diagnosis CLE: Polaritas lampu terbalik",
      };
    }
    if (cs.switchOpen || boardDiag.offSwitchCells.length > 0) {
      if (boardDiag.directCoachingText && boardDiag.misorientedCells.length === 0) {
        return {
          text: boardDiag.directCoachingText,
          note: "Diagnosis CLE: Saklar terbuka (Rangkaian Terbuka)",
        };
      }
      const switchLoc = switchCells.length > 0 ? ` di kotak ${switchCells.join(" atau ")}` : " di papanmu";
      return {
        text: `Hebat, jalur kabelmu sudah tersambung rapi, namun aliran arus masih terhenti karena saklar${switchLoc} masih dalam posisi OFF. Coba raba balok saklar dengan tekstur saklar geser timbul${switchLoc}, lalu putar blok saklarnya 90 derajat dari posisi sekarang agar jalurnya tertutup ke posisi ON. Setelah kamu putar, coba dengarkan apakah lampunya langsung menyala?`,
        note: "Diagnosis CLE: Saklar terbuka (Rangkaian Terbuka)",
      };
    }
    if (boardDiag.directCoachingText) {
      return {
        text: boardDiag.directCoachingText,
        note: "Diagnosis CLE: Orientasi komponen belum tepat",
      };
    }
    return {
      text: "Bagus, kamu sudah mulai menyusun komponen di papan, tetapi jalur rangkaiannya masih terbuka sehingga arus belum bisa mengalir penuh. Coba raba arah alur garis timbul mulai dari baterai dari kotak ke kotak menggunakan ujung jarimu. Adakah kotak yang masih kosong atau arah belokan kabelnya belum bertemu menuju lampu?",
      note: "Diagnosis CLE: Jalur rangkaian terbuka",
    };
  }
  if (cs && !mentionsFault && wantsDiagnosis && cs.allGood && (mode === "troubleshooting" || /benar|selesai|nyala|menyala|berhasil|cek|periksa|correct|done|lit|working|check/.test(m))) {
    return {
      text: "Luar biasa, jalur dari baterai melewati saklar hingga ke lampu sudah tersambung tertutup dengan polaritas yang tepat! Arus listrik kini mengalir lancar menyalakan lampu di rangkaianmu. Menurutmu, apa yang akan terjadi pada arus listrik jika blok saklarnya kita putar 90 derajat dari posisi sekarang?",
      note: "CLE: Rangkaian berhasil tertutup",
    };
  }

  if (mode === "troubleshooting" || mentionsFault) {
    return {
      text: "Mari kita periksa rangkaianmu bersama-sama secara bertahap. Coba telusuri alur kabel timbul dari kutub positif baterai menuju lampu, lalu raba apakah ada sambungan yang belum bertemu atau blok saklar yang belum diputar 90 derajat ke posisi ON.",
      note: "Diagnosis CLE: Penelusuran jalur taktil mandiri",
    };
  }

  if (mode === "reflection" || /kenapa|mengapa|konsep|beda|why|concept|difference/.test(m) || isSeriesParallel) {
    if (isSeriesParallel) {
      return {
        text: "Rangkaian seri disusun berurutan dalam satu jalur tunggal, sehingga jika satu lampu dilepas maka seluruh aliran arus ikut terputus. Sebaliknya, rangkaian paralel membagi arus ke cabang-cabang terpisah menggunakan kabel simpang T. Jadi jika satu cabang dimatikan pada rangkaian paralel, menurutmu apakah lampu di cabang lainnya tetap menyala?",
        note: "Refleksi Konsep: Analogi Jalur Taktil",
      };
    }
    return {
      text: "Arus listrik hanya dapat mengalir jika terdapat lintasan tertutup tanpa putus dari kutub positif baterai, melewati beban lampu, lalu kembali ke kutub negatif baterai. Coba telusuri rangkaian di papanmu dengan jari, apakah alurnya sudah menyambung satu putaran penuh?",
      note: "Refleksi Konsep: Loop Rangkaian Tertutup",
    };
  }

  if (mode === "evaluation" || /kuis|tes|evaluasi|pertanyaan|quiz|test|evaluation|question/.test(m)) {
    return {
      text: "Mari kita uji pemahamanmu lewat tantangan singkat! Jika kamu menyusun 1 baterai dan 2 lampu secara berurutan dalam satu jalur kabel tanpa percabangan, lalu memutar blok saklar 90 derajat ke posisi ON, apakah itu disebut rangkaian seri atau paralel?",
      note: "Evaluasi Formatif: Memahami Rangkaian Seri",
    };
  }

  if (/baterai|battery/.test(m)) {
    return {
      text: "Balok baterai adalah sumber energi listrik yang mendorong arus mengalir ke seluruh rangkaian. Jika kamu meraba bagian atasnya, terdapat simbol timbul tanda tambah (+) untuk kutub positif dan garis pendek (-) untuk kutub negatif. Pastikan arus keluar dari kutub positif menuju jalur kabel dan beban lampu.",
      note: "Eksplorasi Taktil: Mengenali Polaritas Baterai",
    };
  }

  if (/saklar|sakelar|switch/.test(m)) {
    return {
      text: "Balok saklar dapat kamu kenali dari bentuk saklar geser timbul di bagian atasnya (bukan bundar), yang berfungsi menyambung dan memutus arus listrik. Untuk menyalakan atau mematikannya di papan, kamu cukup memutar blok saklar tersebut 90 derajat dari posisi sekarang hingga sejajar dengan jalur kabel.",
      note: "Eksplorasi Taktil: Cara Kerja Balok Saklar",
    };
  }

  if (/lampu|cahaya|lamp|light/.test(m)) {
    return {
      text: "Balok lampu memiliki kubah bundar timbul di bagian tengah sebagai beban listrik, dilengkapi tanda kutub positif (+) dan negatif (-) di kedua sisinya. Jika jalur rangkaian sudah tertutup tetapi lampu belum menyala, angkat dan putar blok lampu 180 derajat agar polaritasnya sesuai.",
      note: "Eksplorasi Taktil: Mengenali Beban Lampu",
    };
  }

  if (/kabel|cable|lurus|belok|cabang|simpang/.test(m)) {
    return {
      text: "Di papan Lentera terdapat tiga jenis balok kabel taktil untuk menghantarkan arus listrik. Ada Kabel Lurus dengan satu alur lurus, Kabel L yang berbelok siku 90 derajat untuk sudut papan, serta Kabel Simpang T untuk membagi arus pada rangkaian paralel.",
      note: "Eksplorasi Taktil: Tiga Jenis Balok Kabel",
    };
  }

  return {
    text: "Halo! Aku LENTERA AI Assistant yang siap mendampingi eksperimen rangkaian listrikmu di papan taktil 5 kali 5. Silakan susun balok komponenmu di papan atau tanyakan apa saja yang ingin kamu pelajari!",
    note: "Dukungan Belajar Inklusif Aktif",
  };
}

function sanitizeBlindFriendlyText(input: string): string {
  return input
    // Ganti "rasakan aliran/arus listrik" menjadi raba arah alur garis timbul mulai dari baterai
    .replace(
      /(?:coba\s+)?(?:rasakan|merasakan)\s+(?:aliran|arus)\s+listrik(?:nya)?/gi,
      "raba arah alur garis timbul mulai dari baterai"
    )
    // Ganti "lihat/perhatikan/amati apakah lampu..." menjadi "dengarkan apakah lampu..."
    .replace(
      /\b(?:coba\s+)?(?:lihat|melihat|perhatikan|memperhatikan|amati|mengamati)\s+(?=apakah\b|lampu\b|nyala\b|indikator\b)/gi,
      "dengarkan "
    )
    // Ganti kata kerja visual umum ("coba lihat", "lihatlah", "lihat di", "perhatikan") menjadi "raba"
    .replace(
      /\b(?:lihatlah|coba\s+lihat|mari\s+lihat|perhatikanlah|coba\s+perhatikan|amatilah|coba\s+amati)\b/gi,
      "coba raba"
    )
    .replace(/\b(?:melihat|memperhatikan|mengamati)\b/gi, "meraba")
    .replace(/\b(?:lihat|perhatikan|amati)\b/gi, "raba");
}

function trimToConciseSentences(raw: string): string {
  const cleaned = sanitizeBlindFriendlyText(
    raw
      .replace(/\*\*|__|\*|`/g, "")
      .replace(/^\s*[-•\d.)]+\s+/gm, "")
      .replace(/\s+/g, " ")
      .trim()
  );
  if (!cleaned) return "";
  const parts =
    cleaned
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((s) => s.trim())
      .filter(Boolean) || [cleaned];
  if (parts.length <= 3) return parts.join(" ");
  const maxCount = parts[0].length <= 22 ? 4 : 3;
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
    const boardDiag = diagnoseCircuitBoard(circuitState);
    const switchCells = findComponentCells(circuitState, "switch");
    const lampCells = findComponentCells(circuitState, "lamp");
    if (sensorStatus === "polarity_reversed") {
      const lampLoc = lampCells.length > 0 ? ` di kotak ${lampCells.join(", ")}` : "";
      diagnosisRule = `\n\nATURAN MUTLAK DIAGNOSIS SENSOR: Status sirkuit polarity_reversed (kutub lampu LED${lampLoc} terbalik, sedangkan jalur kabel sudah tertutup). Jawab dalam 2–3 kalimat yang ramah: beritahu bahwa jalur sudah tersambung tetapi kutub lampu${lampLoc} (berkubah bundar) terbalik, lalu minta siswa memutar blok lampu tersebut 180 derajat.`;
    } else if (sensorStatus === "switch_off") {
      const switchLoc = switchCells.length > 0 ? ` di kotak ${switchCells.join(", ")}` : "";
      diagnosisRule = `\n\nATURAN MUTLAK DIAGNOSIS SENSOR: Rangkaian sudah tersambung tetapi balok saklar${switchLoc} masih OFF. Jawab dalam 2–3 kalimat yang ramah: minta siswa meraba balok saklar${switchLoc} (yang bagian atasnya berbentuk saklar geser timbul, BUKAN bundar), lalu MEMUTAR BLOK SAKLARNYA 90 DERAJAT dari posisi sekarang ke posisi ON (jangan disuruh digeser).`;
    } else if (sensorStatus === "short_circuit") {
      diagnosisRule = "\n\nPERINGATAN BAHAYA SENSOR: Korsleting arus pendek tanpa beban lampu! Jawab dalam 2–3 kalimat: jelaskan bahayanya secara singkat dan minta siswa segera melepas satu kabel atau memasang lampu.";
    } else if (sensorStatus === "no_battery") {
      diagnosisRule = "\n\nDIAGNOSIS SENSOR: Belum ada baterai di papan. Jawab dalam 2–3 kalimat: minta siswa mencari balok baterai (simbol timbul + dan -) untuk dipasang sebagai sumber energi.";
    } else if (sensorStatus === "no_lamp") {
      diagnosisRule = "\n\nDIAGNOSIS SENSOR: Belum ada lampu di papan. Jawab dalam 2–3 kalimat: minta siswa mencari balok lampu (kubah bundar timbul di tengah) untuk dipasang sebagai beban listrik.";
    } else if (sensorStatus === "success") {
      diagnosisRule = "\n\nSTATUS SENSOR: Rangkaian berhasil menyala sempurna! Berikan apresiasi hangat dan tanggapan reflektif dalam 2–3 kalimat.";
    }

    if (boardDiag.primaryFaults.length > 0) {
      diagnosisRule += `\n\nFAKTA MUTLAK HASIL ANALISIS GEOMETRI PAPAN (100% AKURAT — WAJIB JADIKAN DASAR JAWABAN UTAMA):\n- Kesalahan spesifik di papan saat ini: ${boardDiag.primaryFaults.join(" ")}\n- Komponen yang SUDAH TERSAMBUNG BENAR (DILARANG KERAS MENYALAHKAN ATAU MENYURUH MEMUTAR KOMPONEN INI): ${boardDiag.correctCells.join(", ") || "tidak ada"}.`;
    } else if (boardDiag.correctCells.length > 0) {
      diagnosisRule += `\n\nFAKTA GEOMETRI PAPAN: Komponen yang sudah terpasang dengan orientasi benar: ${boardDiag.correctCells.join(", ")}.`;
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

    const brevityRule = `\n\nATURAN PANJANG & GAYA JAWABAN (WAJIB): Jawab dalam 2–3 kalimat yang hangat, jelas, dan pas (sekitar 35–55 kata), tanpa poin-poin. PENTING: (1) Ciri rabaan di atas balok saklar adalah bentuk saklar geser timbul (bukan bundar), TETAPI cara menyalakannya di papan adalah dengan MEMUTAR BLOK SAKLAR 90 DERAJAT dari posisi sekarang (bukan digeser). (2) JANGAN PERNAH gunakan kata "lihat/perhatikan/amati" (gunakan "dengarkan apakah lampu menyala") dan JANGAN PERNAH katakan "rasakan aliran listrik" (gunakan "raba arah alur garis timbul mulai dari baterai melewati kabel hingga ke lampu").`;

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
