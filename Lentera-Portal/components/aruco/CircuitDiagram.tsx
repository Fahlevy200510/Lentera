"use client";

import { useEffect, useState } from "react";

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
  if (!component || component.startsWith("student_") || component.startsWith("teacher")) {
    return [];
  }
  const base = COMPONENT_DEFAULT_SIDES[component];
  if (!base) return ["Atas", "Bawah", "Kiri", "Kanan"];
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  return base.map((s) => CW_ORDER[(CW_ORDER.indexOf(s) + steps) % 4]);
}

function getTerminals(component: string, rotation: number = 0): { "+": Direction; "-": Direction } | null {
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  if (component === "battery") {
    return {
      "+": CW_ORDER[(CW_ORDER.indexOf("Atas") + steps) % 4],
      "-": CW_ORDER[(CW_ORDER.indexOf("Bawah") + steps) % 4],
    };
  }
  if (component === "lamp") {
    return {
      "+": CW_ORDER[(CW_ORDER.indexOf("Kiri") + steps) % 4],
      "-": CW_ORDER[(CW_ORDER.indexOf("Kanan") + steps) % 4],
    };
  }
  return null;
}

function getStepDirection(fromCell: string, toCell: string): Direction | null {
  const [fx, fy] = cellToXY(fromCell);
  const [tx, ty] = cellToXY(toCell);
  const dx = tx - fx;
  const dy = ty - fy;
  for (const [side, [sx, sy]] of Object.entries(DIRECTIONS) as [Direction, [number, number]][]) {
    if (sx === dx && sy === dy) return side;
  }
  return null;
}

function getSwitchWireOrientation(
  cellName: string,
  cells: Record<string, any>,
  loop?: string[]
): "horizontal" | "vertical" {
  const state = cells[cellName];
  if (state?.wire_orientation === "vertical" || state?.wire_orientation === "horizontal") {
    if (!loop) return state.wire_orientation;
  }
  if (loop && loop.includes(cellName)) {
    const idx = loop.indexOf(cellName);
    const prev = loop[(idx - 1 + loop.length) % loop.length];
    const next = loop[(idx + 1) % loop.length];
    const d1 = getStepDirection(cellName, prev);
    const d2 = getStepDirection(cellName, next);
    if (d1 && d2) {
      if ((d1 === "Atas" || d1 === "Bawah") && (d2 === "Atas" || d2 === "Bawah")) return "vertical";
      if ((d1 === "Kiri" || d1 === "Kanan") && (d2 === "Kiri" || d2 === "Kanan")) return "horizontal";
    }
  }

  const [x, y] = cellToXY(cellName);
  let vertCount = 0;
  let horizCount = 0;

  for (const side of ["Atas", "Bawah"] as Direction[]) {
    const [dx, dy] = DIRECTIONS[side];
    const nb = xyToCell(x + dx, y + dy);
    if (nb && cells[nb]) {
      const nOpen = getOpenSides(cells[nb].component, cells[nb].rotation);
      if (nOpen.includes(OPPOSITE[side])) vertCount++;
    }
  }
  for (const side of ["Kiri", "Kanan"] as Direction[]) {
    const [dx, dy] = DIRECTIONS[side];
    const nb = xyToCell(x + dx, y + dy);
    if (nb && cells[nb]) {
      const nOpen = getOpenSides(cells[nb].component, cells[nb].rotation);
      if (nOpen.includes(OPPOSITE[side])) horizCount++;
    }
  }

  if (vertCount > horizCount) return "vertical";
  if (horizCount > vertCount) return "horizontal";

  const rot = state?.rotation ?? 0;
  return rot === 90 || rot === 270 ? "vertical" : "horizontal";
}

function isSwitchClosedInLoop(
  cellName: string,
  cells: Record<string, any>,
  variant: string = "live",
  loop?: string[]
): boolean {
  if (variant === "open") return false;
  if (variant === "closed" || variant === "series" || variant === "parallel") return true;

  const state = cells[cellName];
  if (!state || state.component !== "switch") return false;
  if (typeof state.is_on === "boolean" && !loop) {
    return state.is_on;
  }
  const rot = ((state.rotation ?? 0) % 360 + 360) % 360;
  const orientation = getSwitchWireOrientation(cellName, cells, loop);
  return orientation === "vertical" ? rot === 0 || rot === 180 : rot === 90 || rot === 270;
}

/**
 * Menghitung himpunan sel yang benar-benar dialiri arus listrik (loop tertutup,
 * memiliki beban lampu/resistor, seluruh saklar di jalurnya ON, dan polaritas lampu benar).
 * Dengan ini, pada rangkaian paralel, cabang yang saklarnya masih OFF tidak akan ikut menyala!
 */
function computeActiveCircuitCells(cells: Record<string, any>, variant: string = "live"): Set<string> {
  const active = new Set<string>();
  if (!cells || typeof cells !== "object") return active;
  if (variant === "open") return active;

  const batteries = Object.keys(cells).filter((c) => cells[c]?.component === "battery");
  if (batteries.length === 0) return active;

  // Bangun graf konektivitas antar sel
  const graph: Record<string, Set<string>> = {};
  for (const [cellName, state] of Object.entries(cells)) {
    if (!state) continue;
    const [x, y] = cellToXY(cellName);
    const openSides = getOpenSides(state.component, state.rotation);
    for (const side of openSides) {
      const [dx, dy] = DIRECTIONS[side];
      const nb = xyToCell(x + dx, y + dy);
      if (nb && cells[nb]) {
        const nbOpen = getOpenSides(cells[nb].component, cells[nb].rotation);
        if (nbOpen.includes(OPPOSITE[side])) {
          if (!graph[cellName]) graph[cellName] = new Set();
          if (!graph[nb]) graph[nb] = new Set();
          graph[cellName].add(nb);
          graph[nb].add(cellName);
        }
      }
    }
  }

  // Cari seluruh loop sederhana yang melewati baterai
  const loops: string[][] = [];
  for (const startNode of batteries) {
    const stack: Array<{ curr: string; path: string[] }> = [{ curr: startNode, path: [startNode] }];
    while (stack.length > 0) {
      const { curr, path } = stack.pop()!;
      const neighbors = graph[curr] ? Array.from(graph[curr]) : [];
      for (const nb of neighbors) {
        if (path.length > 1 && nb === path[path.length - 2]) continue;
        if (nb === startNode) {
          loops.push(path);
        } else if (!path.includes(nb)) {
          stack.push({ curr: nb, path: [...path, nb] });
        }
      }
    }
  }

  // Jika ada korsleting aktif (loop tanpa lampu/resistor dan saklarnya ON), tidak ada lampu yang menyala
  for (const loop of loops) {
    const hasLoad = loop.some((c) => ["lamp", "resistor"].includes(cells[c]?.component));
    if (!hasLoad) {
      const hasOffSwitch = loop.some(
        (c) => cells[c]?.component === "switch" && !isSwitchClosedInLoop(c, cells, variant, loop)
      );
      if (!hasOffSwitch) {
        return new Set<string>();
      }
    }
  }

  // Periksa setiap loop yang memuat lampu: apakah saklar di loop tersebut ON dan polaritas lampu benar
  for (const loop of loops) {
    const hasLamp = loop.some((c) => cells[c]?.component === "lamp");
    if (!hasLamp) continue;

    const hasOffSwitch = loop.some(
      (c) => cells[c]?.component === "switch" && !isSwitchClosedInLoop(c, cells, variant, loop)
    );
    if (hasOffSwitch) continue;

    // Orientasikan arah arus dari kutub (+) baterai
    const bCell = loop[0];
    const nextCell = loop[1];
    const sideToNext = getStepDirection(bCell, nextCell);
    const bTerms = getTerminals("battery", cells[bCell]?.rotation ?? 0);
    const oriented =
      bTerms && sideToNext === bTerms["-"] ? [bCell, ...loop.slice(1).reverse()] : loop;

    let polarityOk = true;
    for (let i = 0; i < oriented.length; i++) {
      const c = oriented[i];
      if (cells[c]?.component === "lamp") {
        const prev = oriented[(i - 1 + oriented.length) % oriented.length];
        const entryDir = getStepDirection(prev, c);
        if (entryDir) {
          const entrySideOnLamp = OPPOSITE[entryDir];
          const lTerms = getTerminals("lamp", cells[c]?.rotation ?? 0);
          if (!lTerms || entrySideOnLamp !== lTerms["+"]) {
            polarityOk = false;
            break;
          }
        }
      }
    }

    if (polarityOk) {
      for (const c of loop) {
        active.add(c);
      }
    }
  }

  return active;
}

export default function CircuitDiagram({ variant = "live" }: { variant?: string }) {
  const [state, setState] = useState<any>({ cells: {}, isComplete: false });

  useEffect(() => {
    const handleUpdate = (e: Event) => setState((e as CustomEvent).detail);
    window.addEventListener("circuit-update", handleUpdate);
    return () => window.removeEventListener("circuit-update", handleUpdate);
  }, []);

  let cells: Record<string, any> = state.cells || {};

  if (variant && variant !== "live") {
    if (variant === "series") {
      cells = {
        B4: { component: "battery", rotation: 0 },
        B5: { component: "l_cable", rotation: 90 },
        C5: { component: "switch", rotation: 90, is_on: true },
        D5: { component: "lamp", rotation: 0 },
        E5: { component: "l_cable", rotation: 180 },

        E4: { component: "switch", rotation: 0, is_on: true },
        E3: { component: "lamp", rotation: 90 },
        E2: { component: "l_cable", rotation: 270 },

        D2: { component: "straight_cable", rotation: 0 },
        C2: { component: "straight_cable", rotation: 0 },
        B2: { component: "l_cable", rotation: 0 },
        B3: { component: "straight_cable", rotation: 90 },
      };
    } else if (variant === "parallel") {
      cells = {
        B5: { component: "l_cable", rotation: 90 },
        C5: { component: "battery", rotation: 270 },
        D5: { component: "straight_cable", rotation: 0 },
        E5: { component: "l_cable", rotation: 180 },

        B4: { component: "t_cable", rotation: 270 },
        C4: { component: "switch", rotation: 90, is_on: true },
        D4: { component: "lamp", rotation: 0 },
        E4: { component: "t_cable", rotation: 90 },

        B3: { component: "l_cable", rotation: 0 },
        C3: { component: "switch", rotation: 90, is_on: true },
        D3: { component: "lamp", rotation: 0 },
        E3: { component: "l_cable", rotation: 270 },
      };
    } else if (variant === "closed") {
      cells = {
        C4: { component: "battery", rotation: 270 },
        B4: { component: "l_cable", rotation: 90 },
        D4: { component: "l_cable", rotation: 180 },
        B2: { component: "l_cable", rotation: 0 },
        D2: { component: "l_cable", rotation: 270 },
        B3: { component: "straight_cable", rotation: 90 },
        D3: { component: "switch", rotation: 0, is_on: true },
        C2: { component: "lamp", rotation: 0 },
      };
    } else if (variant === "open") {
      cells = {
        C4: { component: "battery", rotation: 270 },
        B4: { component: "l_cable", rotation: 90 },
        D4: { component: "l_cable", rotation: 180 },
        B2: { component: "l_cable", rotation: 0 },
        D2: { component: "l_cable", rotation: 270 },
        B3: { component: "straight_cable", rotation: 90 },
        D3: { component: "switch", rotation: 90, is_on: false },
        C2: { component: "lamp", rotation: 0 },
      };
    }
  }

  // Hitung sel mana saja yang benar-benar dialiri arus listrik (per cabang)
  const activeCells = computeActiveCircuitCells(cells, variant);

  const cols = ["A", "B", "C", "D", "E"];
  const getXY = (cell: string) => {
    const colIdx = cols.indexOf(cell[0]);
    const rowIdx = parseInt(cell[1]) - 1;
    return { x: 74 + colIdx * 80, y: 74 + (4 - rowIdx) * 80 };
  };

  return (
    <svg viewBox="0 0 468 468" className="h-auto w-full overflow-visible" role="img">
      <defs>
        <filter id="bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="wireGlow" filterUnits="userSpaceOnUse" x="-50" y="-50" width="100" height="100">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Subtle Board Grid Frame */}
      <rect
        x="26"
        y="26"
        width="416"
        height="416"
        rx="18"
        fill="rgba(30, 27, 75, 0.55)"
        stroke="rgba(167, 139, 250, 0.32)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Axis Labels: Columns A-E (Top & Bottom) */}
      {cols.map((col, idx) => {
        const x = 74 + idx * 80;
        return (
          <g key={`col-label-${col}`}>
            <text
              x={x}
              y="13"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="800"
              fontFamily="monospace"
            >
              {col}
            </text>
            <text
              x={x}
              y="455"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="800"
              fontFamily="monospace"
            >
              {col}
            </text>
          </g>
        );
      })}

      {/* Axis Labels: Rows 5-1 (Left & Right) */}
      {[5, 4, 3, 2, 1].map((row, idx) => {
        const y = 74 + idx * 80;
        return (
          <g key={`row-label-${row}`}>
            <text
              x="12"
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="800"
              fontFamily="monospace"
            >
              {row}
            </text>
            <text
              x="456"
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="800"
              fontFamily="monospace"
            >
              {row}
            </text>
          </g>
        );
      })}

      {/* Background grid points */}
      {cols.map((c) =>
        [1, 2, 3, 4, 5].map((r) => {
          const { x, y } = getXY(`${c}${r}`);
          return (
            <g key={`${c}${r}`}>
              <circle cx={x} cy={y} r="5" fill="rgba(148, 163, 184, 0.25)" />
              <circle cx={x} cy={y} r="2" fill="#94a3b8" />
            </g>
          );
        })
      )}

      {/* Render Components dynamically per-branch active state */}
      {Object.entries(cells).map(([cell, compData]: [string, any]) => {
        if (!compData) return null;
        const compName = String(compData.component || "");
        if (compName.startsWith("student_") || compName.startsWith("teacher") || Number(compData.id) >= 30) {
          return null;
        }

        const { x, y } = getXY(cell);
        const { component, rotation } = compData;
        const isCellActive = activeCells.has(cell);

        let effectiveRotation = rotation;
        if (component === "switch") {
          const orient = getSwitchWireOrientation(cell, cells);
          effectiveRotation = orient === "vertical" ? 90 : 0;
        }

        const switchClosed =
          component === "switch" ? isSwitchClosedInLoop(cell, cells, variant) : false;

        return (
          <g
            key={cell}
            transform={`translate(${x}, ${y}) rotate(${effectiveRotation})`}
            className="transition-all duration-500"
          >
            {renderComponent(component, isCellActive, rotation, switchClosed)}
          </g>
        );
      })}
    </svg>
  );
}

function renderComponent(
  type: string,
  isCellActive: boolean,
  rotation: number = 0,
  isSwitchOn: boolean = false
) {
  const stroke = isCellActive ? "#8b5cf6" : "#475569";
  const dim = "#475569";

  let content = null;
  switch (type) {
    case "straight_cable":
      content = (
        <line
          x1="-40"
          y1="0"
          x2="40"
          y2="0"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          filter={isCellActive ? "url(#wireGlow)" : ""}
        />
      );
      break;
    case "l_cable":
      content = (
        <path
          d="M 0 -40 L 0 0 L 40 0"
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          filter={isCellActive ? "url(#wireGlow)" : ""}
        />
      );
      break;
    case "t_cable":
      content = (
        <path
          d="M -40 0 L 40 0 M 0 40 L 0 0"
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          filter={isCellActive ? "url(#wireGlow)" : ""}
        />
      );
      break;
    case "battery":
      content = (
        <g>
          <rect
            x="-15"
            y="-25"
            width="30"
            height="50"
            rx="4"
            fill="#0b1220"
            stroke={isCellActive ? "#c084fc" : dim}
            strokeWidth="4"
          />
          <line
            x1="-8"
            y1="-10"
            x2="8"
            y2="-10"
            stroke={isCellActive ? "#c084fc" : dim}
            strokeWidth="3"
          />
          <line
            x1="-4"
            y1="10"
            x2="4"
            y2="10"
            stroke={isCellActive ? "#c084fc" : dim}
            strokeWidth="3"
          />

          <g transform={`translate(0, -34) rotate(${-rotation})`}>
            <text
              x="0"
              y="0"
              fill={isCellActive ? "#c084fc" : dim}
              fontSize="14"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              +
            </text>
          </g>
          <g transform={`translate(0, 34) rotate(${-rotation})`}>
            <text
              x="0"
              y="0"
              fill={isCellActive ? "#c084fc" : dim}
              fontSize="16"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              -
            </text>
          </g>
        </g>
      );
      break;
    case "lamp":
      content = (
        <g>
          <circle
            cx="0"
            cy="0"
            r="18"
            fill={isCellActive ? "rgba(250, 204, 21, 0.18)" : "#0b1220"}
            stroke={isCellActive ? "#fef08a" : dim}
            strokeWidth="4"
            filter={isCellActive ? "url(#bulbGlow)" : ""}
          />
          <path
            d="M -10 -10 L 10 10 M -10 10 L 10 -10"
            stroke={isCellActive ? "#fef08a" : dim}
            strokeWidth="3"
            strokeLinecap="round"
          />

          <g transform={`translate(-30, 0) rotate(${-rotation})`}>
            <text
              x="0"
              y="0"
              fill={isCellActive ? "#fef08a" : dim}
              fontSize="13"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              +
            </text>
          </g>
          <g transform={`translate(30, 0) rotate(${-rotation})`}>
            <text
              x="0"
              y="0"
              fill={isCellActive ? "#fef08a" : dim}
              fontSize="15"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              -
            </text>
          </g>
        </g>
      );
      break;
    case "switch":
      content = (
        <g>
          <line
            x1="-40"
            y1="0"
            x2="-20"
            y2="0"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            filter={isCellActive ? "url(#wireGlow)" : ""}
          />
          <line
            x1="20"
            y1="0"
            x2="40"
            y2="0"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            filter={isCellActive ? "url(#wireGlow)" : ""}
          />
          <circle cx="-20" cy="0" r="4" fill={isSwitchOn && isCellActive ? "#34d399" : isSwitchOn ? "#94a3b8" : "#ec4899"} />
          <circle cx="20" cy="0" r="4" fill={isSwitchOn && isCellActive ? "#34d399" : isSwitchOn ? "#94a3b8" : "#ec4899"} />
          <line
            x1="-20"
            y1="0"
            x2={isSwitchOn ? "20" : "16"}
            y2={isSwitchOn ? "0" : "-15"}
            stroke={isSwitchOn && isCellActive ? "#34d399" : isSwitchOn ? "#94a3b8" : "#ec4899"}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      );
      break;
    case "resistor":
      content = (
        <g>
          <path
            d="M -40 0 L -20 0 L -15 -10 L -5 10 L 5 -10 L 15 10 L 20 0 L 40 0"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      );
      break;
    default:
      content = null;
  }

  return <g>{content}</g>;
}
