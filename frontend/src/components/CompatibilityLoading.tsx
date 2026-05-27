import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MainScreenStarBackground } from "@/components/MainScreenStarBackground";

type Act = "self" | "other" | "merge";

interface CompatibilityLoadingProps {
  /** Optional display name of the other person, shown in act 2/3. */
  otherName?: string;
}

const ACT_TIMINGS: Record<Exclude<Act, "merge">, number> = {
  self: 3600,
  other: 3600,
};

const CAPTIONS: Record<Act, string[]> = {
  self: ["Считываю положения планет", "Фиксирую дома и стихии"],
  other: ["Собираю карту другого человека", "Сверяю с твоими координатами"],
  merge: [
    "Сравниваю стихии и акценты",
    "Ищу резонансы и контрасты",
    "Собираю инсайты",
    "Формулирую разбор",
  ],
};

const CAPTION_INTERVAL = 1800;

/**
 * Three-act loading sequence for the compatibility flow.
 * Act 1 — draws "your" chart. Act 2 — draws the other person's chart.
 * Act 3 — charts converge, aspect rays flash, ember-glow core breathes
 * until the API responds.
 */
export function CompatibilityLoading({ otherName }: CompatibilityLoadingProps = {}) {
  const [act, setAct] = useState<Act>("self");
  const [captionIdx, setCaptionIdx] = useState(0);

  useEffect(() => {
    const t1 = window.setTimeout(() => setAct("other"), ACT_TIMINGS.self);
    const t2 = window.setTimeout(
      () => setAct("merge"),
      ACT_TIMINGS.self + ACT_TIMINGS.other,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // Reset + cycle captions per act
  useEffect(() => {
    setCaptionIdx(0);
    const list = CAPTIONS[act];
    if (list.length <= 1) return;
    const id = window.setInterval(() => {
      setCaptionIdx((i) => (i + 1) % list.length);
    }, CAPTION_INTERVAL);
    return () => window.clearInterval(id);
  }, [act]);

  const topLabel =
    act === "self"
      ? "ТВОЯ КАРТА"
      : act === "other"
        ? `КАРТА ${(otherName || "ДРУГОГО ЧЕЛОВЕКА").toUpperCase()}`
        : "СОВМЕСТИМОСТЬ";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "hsl(0 0% 4%)", color: "hsl(0 0% 98%)" }}
    >
      <MainScreenStarBackground />

      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Top label */}
        <div className="h-5 mb-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={topLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.75, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-[10px] uppercase tracking-[0.32em] text-center"
              style={{ color: "hsl(0 0% 92%)" }}
            >
              {topLabel}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Stage */}
        <div className="relative h-[260px] w-[260px]">
          <ChartSlot act={act} side="left" />
          {(act === "other" || act === "merge") && <ChartSlot act={act} side="right" />}
          {act === "merge" && <AspectRays />}
          {act === "merge" && <CoreSpark />}
        </div>

        {/* Caption */}
        <div className="mt-12 h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={`${act}-${captionIdx}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-[12px] uppercase tracking-[0.3em] text-center"
              style={{ color: "hsl(0 0% 85%)" }}
            >
              {CAPTIONS[act][captionIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* -------------------- chart slot -------------------- */

function ChartSlot({ act, side }: { act: Act; side: "left" | "right" }) {
  // Target x per act
  const isLeft = side === "left";
  const x =
    act === "self"
      ? 0
      : act === "other"
        ? isLeft
          ? -70
          : 70
        : isLeft
          ? -22
          : 22;

  const dimmed = act === "other" && isLeft;
  const opacity = dimmed ? 0.28 : 1;
  const reverse = !isLeft;

  return (
    <motion.div
      initial={isLeft ? { x: 0, opacity: 0 } : { x: 90, opacity: 0 }}
      animate={{ x, opacity }}
      transition={{ duration: 1.1, ease: "easeOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <ChartSVG
        reverse={reverse}
        drawDelay={isLeft ? 0 : 0.1}
        // First chart draws once at mount; second one draws when it mounts
        playKey={isLeft ? "self" : "other"}
      />
    </motion.div>
  );
}

/* -------------------- chart svg -------------------- */

const PLANET_COUNT = 7;

function ChartSVG({
  reverse = false,
  drawDelay = 0,
  playKey,
}: {
  reverse?: boolean;
  drawDelay?: number;
  playKey: string;
}) {
  // continuous slow rotation (independent of draw-in)
  return (
    <motion.div
      className="relative h-[180px] w-[180px]"
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration: reverse ? 48 : 40, repeat: Infinity, ease: "linear" }}
    >
      <svg width="180" height="180" viewBox="0 0 200 200" className="absolute inset-0">
        {/* outer ring */}
        <motion.circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="hsl(0 0% 100% / 0.22)"
          strokeWidth="0.6"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, delay: drawDelay, ease: "easeOut" }}
        />
        {/* inner ring */}
        <motion.circle
          cx="100"
          cy="100"
          r="74"
          fill="none"
          stroke="hsl(0 0% 100% / 0.3)"
          strokeWidth="0.6"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.0, delay: drawDelay + 0.25, ease: "easeOut" }}
        />
        {/* core ring */}
        <motion.circle
          cx="100"
          cy="100"
          r="52"
          fill="none"
          stroke="hsl(0 0% 100% / 0.2)"
          strokeWidth="0.6"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: drawDelay + 0.45, ease: "easeOut" }}
        />
        {/* 12 sector ticks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 12;
          const x1 = 100 + Math.cos(angle) * 74;
          const y1 = 100 + Math.sin(angle) * 74;
          const x2 = 100 + Math.cos(angle) * 92;
          const y2 = 100 + Math.sin(angle) * 92;
          return (
            <motion.line
              key={`s${playKey}-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(0 0% 100% / 0.28)"
              strokeWidth="0.5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: drawDelay + 0.7 + i * 0.04,
                ease: "easeOut",
              }}
            />
          );
        })}
        {/* planet dots */}
        {Array.from({ length: PLANET_COUNT }).map((_, i) => {
          const angle = (i * Math.PI * 2) / PLANET_COUNT - Math.PI / 2;
          const r = 63;
          const cx = 100 + Math.cos(angle) * r;
          const cy = 100 + Math.sin(angle) * r;
          return (
            <motion.circle
              key={`p${playKey}-${i}`}
              cx={cx}
              cy={cy}
              r="1.8"
              fill="hsl(0 0% 100%)"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0.85], scale: [0.4, 1.4, 1] }}
              transition={{
                duration: 0.6,
                delay: drawDelay + 1.3 + i * 0.12,
                ease: "easeOut",
              }}
            />
          );
        })}
      </svg>
    </motion.div>
  );
}

/* -------------------- aspect rays (act 3) -------------------- */

function AspectRays() {
  // Lines between planet positions of the two overlapped charts.
  // We draw them in the merged-stage coordinate space (260x260 box).
  // Left chart center: (108, 130); right: (152, 130). Each chart radius 63 (from 180/2 viewbox-scaled).
  // Use chart-local planet angles and offset by side.
  const leftCx = 108;
  const rightCx = 152;
  const cy = 130;
  const r = 56; // visual radius for planet projection on 260 box (180/2 * 0.62 ish)

  // pick 6 cross-pairs (i -> j shifted)
  const pairs = [
    [0, 3],
    [1, 5],
    [2, 6],
    [4, 0],
    [5, 2],
    [3, 1],
  ];

  return (
    <svg
      width="260"
      height="260"
      viewBox="0 0 260 260"
      className="absolute inset-0 pointer-events-none"
    >
      {pairs.map(([a, b], i) => {
        const aAng = (a * Math.PI * 2) / PLANET_COUNT - Math.PI / 2;
        const bAng = (b * Math.PI * 2) / PLANET_COUNT - Math.PI / 2;
        const x1 = leftCx + Math.cos(aAng) * r;
        const y1 = cy + Math.sin(aAng) * r;
        const x2 = rightCx + Math.cos(bAng) * r;
        const y2 = cy + Math.sin(bAng) * r;
        return (
          <motion.line
            key={`ray-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="hsl(var(--accent-ember) / 0.55)"
            strokeWidth="0.6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: [0, 1, 1], opacity: [0, 0.85, 0] }}
            transition={{
              duration: 2.2,
              delay: 0.4 + i * 0.32,
              repeat: Infinity,
              repeatDelay: 1.4,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </svg>
  );
}

/* -------------------- core spark (act 3) -------------------- */

function CoreSpark() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0.7, 1, 0.8], scale: [0.9, 1.15, 0.95] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div
        className="h-[7px] w-[7px] rounded-full"
        style={{
          background: "hsl(var(--accent-ember))",
          boxShadow:
            "0 0 14px hsl(var(--accent-ember) / 0.85), 0 0 36px hsl(var(--accent-ember) / 0.55), 0 0 64px hsl(var(--accent-ember) / 0.3)",
        }}
      />
    </motion.div>
  );
}
