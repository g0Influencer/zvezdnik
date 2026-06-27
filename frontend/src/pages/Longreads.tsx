import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { NatalChartArt } from "@/components/NatalChartArt";
import { LongreadRevealAnimation } from "@/components/LongreadRevealAnimation";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { getTopicsForUser, renderLongreadBody, applySheetBodies, type LongreadTopic } from "@/lib/longread-config";
import { Paywall } from "@/components/Paywall";
import { haptic } from "@/lib/telegram";
import { getZodiacSign } from "@/lib/zodiac";
import { getLongreadsForUser, type LongreadsByKey } from "@/lib/content/longreads-source";
import {
  getCurrentWeeklyLongread,
  splitWeeklyParagraphs,
  type WeeklyLongread,
} from "@/lib/content/weekly-longreads-source";
import { reachGoal } from "@/lib/metrika";

export default function LongreadsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAppStore();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [openTopic, setOpenTopic] = useState<LongreadTopic | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [sheetBodies, setSheetBodies] = useState<LongreadsByKey>({});
  const [weekly, setWeekly] = useState<WeeklyLongread | null>(null);
  const [weeklyLoaded, setWeeklyLoaded] = useState(false);
  const [portrait, setPortrait] = useState<string>('');

  const personalization = user?.personalization as Record<string, unknown> | null;
  const baseTopics = getTopicsForUser(personalization);
  const topicsWithSheet = applySheetBodies(baseTopics, sheetBodies);

  // Replace the weekly-longread slot with sheet-driven content when available.
  // If sheet has no rows at all, drop the placeholder card (we render an empty
  // state in its place below).
  const topics: LongreadTopic[] = topicsWithSheet
    .map((t) => {
      if (t.id === "weekly-longread") {
        if (!weekly) return null;
        return {
          ...t,
          title: weekly.title,
          emoji: weekly.logoEmoji,
          description: weekly.shortDescription || t.description,
          body: splitWeeklyParagraphs(weekly.text),
        };
      }
      if (t.id === "natal-chart" && portrait) {
        return {
          ...t,
          body: portrait
            .replace(/\r\n/g, "\n")
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean),
        };
      }
      return t;
    })
    .filter((t): t is LongreadTopic => !!t);

  const isPro = user?.pro_status === "active";

  useEffect(() => {
    let cancelled = false;
    getLongreadsForUser(user?.gender ?? null).then((res) => {
      if (!cancelled) setSheetBodies(res);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.gender]);

  useEffect(() => {
    let cancelled = false;
    getCurrentWeeklyLongread()
      .then((res) => {
        if (!cancelled) setWeekly(res);
      })
      .finally(() => {
        if (!cancelled) setWeeklyLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getChart()
      .then((c) => {
        if (!cancelled && c?.portrait) setPortrait(c.portrait);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    reachGoal("longreads_open");
  }, []);

  const openedLongreads = (personalization?.opened_longreads as string[]) || [];

  const handleTap = (topic: LongreadTopic) => {
    haptic("light");
    const unlocked = isPro || !topic.proOnly;
    if (!unlocked) {
      reachGoal("paywall_open");
      setPaywallOpen(true);
      return;
    }
    if (topic.id === "other-person-chart") {
      navigate("/compatibility");
      return;
    }
    if (topic.id === "natal-chart") reachGoal("longread_natal_chart_open");
    if (topic.id === "inner-resource") reachGoal("longread_inner_resource_open");
    if (openedLongreads.includes(topic.id)) {
      setOpenTopic(topic);
    } else {
      setRevealingId(topic.id);
    }
  };

  const handleRevealComplete = async () => {
    if (!revealingId) return;
    const topic = topics.find((t) => t.id === revealingId);
    if (!topic) {
      setRevealingId(null);
      return;
    }
    // Persist to user (optimistic)
    const nextOpened = Array.from(new Set([...openedLongreads, revealingId]));
    const nextPersonalization = {
      ...(personalization || {}),
      opened_longreads: nextOpened,
    };
    if (user) {
      setUser({ ...user, personalization: nextPersonalization });
    }
    setOpenTopic(topic);
    setRevealingId(null);
    try {
      await api.updateProfile({ personalization: nextPersonalization });
    } catch (e) {
      // Non-critical: animation will simply replay if save failed
      console.warn("Failed to persist opened longread", e);
    }
  };

  const handleBack = () => {
    haptic("light");
    setOpenTopic(null);
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="px-5 pt-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Header */}
          <h1 className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground mb-3">Лонгриды</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground mb-8">
            Персональные астро-расчёты по твоей натальной карте. Новый глубокий разбор одной важной темы — каждую неделю
            c подпиской PRO.
          </p>

          {/* Topic Cards */}
          <div className="space-y-3">
            {weeklyLoaded && !weekly && (
              <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-1">
                  Еженедельный лонгрид
                </p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Свежий разбор недели ещё готовится. Загляни чуть позже.
                </p>
              </div>
            )}
            {topics.map((topic, index) => {
              const unlocked = isPro || !topic.proOnly;
              const isHighlighted = topic.highlighted;
              const isEmber = topic.id === "other-person-chart";

              return (
                <motion.button
                  key={topic.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => handleTap(topic)}
                  style={
                    isEmber
                      ? {
                          borderColor: "hsl(var(--accent-ember) / 0.35)",
                          boxShadow:
                            "0 0 0 1px hsl(var(--accent-ember) / 0.08), 0 8px 28px -12px hsl(var(--accent-ember) / 0.45)",
                          background:
                            "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 60%, hsl(var(--accent-ember) / 0.08) 100%)",
                        }
                      : undefined
                  }
                  className={`relative w-full text-left rounded-xl border p-4 transition-all ${
                    isEmber
                      ? "hover:brightness-110"
                      : isHighlighted
                        ? "border-foreground/20 bg-secondary hover:border-foreground/30"
                        : "border-border bg-card hover:border-foreground/20"
                  } ${!unlocked ? "opacity-90" : ""}`}
                >
                  {isEmber && (
                    <span
                      aria-hidden
                      className="absolute top-3 right-3 flex h-1.5 w-1.5"
                    >
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                        style={{ backgroundColor: "hsl(var(--accent-ember))" }}
                      />
                      <span
                        className="relative inline-flex h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "hsl(var(--accent-ember))" }}
                      />
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{topic.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {topic.id === "weekly-longread" && (
                          <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80 border border-border px-2 py-0.5 rounded-full">
                            Еженедельный
                          </span>
                        )}
                        {isEmber && (
                          <span
                            className="text-[9px] font-semibold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                            style={{
                              color: "hsl(var(--accent-ember))",
                              borderWidth: 1,
                              borderStyle: "solid",
                              borderColor: "hsl(var(--accent-ember) / 0.4)",
                              backgroundColor: "hsl(var(--accent-ember) / 0.08)",
                            }}
                          >
                            Новое
                          </span>
                        )}
                        <p className="text-[13px] font-medium text-foreground">{topic.title}</p>
                        {topic.proOnly && unlocked && !isEmber && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60 bg-secondary border border-border px-2 py-0.5 rounded-full">
                            Pro
                          </span>
                        )}
                        {topic.proOnly && !unlocked && !isEmber && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                            <Lock className="h-2.5 w-2.5" />
                            Pro
                          </span>
                        )}
                        {topic.proOnly && isEmber && (
                          <span
                            className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                            style={{
                              color: "hsl(var(--accent-ember))",
                              borderWidth: 1,
                              borderStyle: "solid",
                              borderColor: "hsl(var(--accent-ember) / 0.4)",
                              backgroundColor: "transparent",
                            }}
                          >
                            {!unlocked && <Lock className="h-2.5 w-2.5" />}
                            Pro
                          </span>
                        )}
                        {!topic.proOnly && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground bg-secondary border border-border px-2 py-0.5 rounded-full">
                            читать
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[12px] leading-relaxed mt-1 ${
                          unlocked ? "text-muted-foreground" : "text-muted-foreground/80"
                        }`}
                      >
                        {topic.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Bottom info */}
          <div className="mt-8 mb-4 text-center">
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">{"\n"}</p>
          </div>
        </motion.div>
      </div>

      {/* Reader overlay */}
      <AnimatePresence>
        {openTopic && openTopic.body && (
          <motion.div
            key="reader"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-background overflow-y-auto"
          >
            {/* Sticky back bar */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
              <div className="px-5 py-3 flex items-center">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.2em] text-foreground hover:text-foreground/70 transition-colors"
                  aria-label="Назад к списку лонгридов"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Назад
                </button>
              </div>
            </div>

            {/* Article body */}
            <article className="px-5 pt-6 pb-32 max-w-2xl mx-auto">
              {openTopic.id === "natal-chart" ? (
                <>
                  <div className="text-3xl mb-3">{openTopic.emoji}</div>
                  <h2 className="text-[22px] leading-tight font-medium text-foreground mb-2">{openTopic.title}</h2>
                  <p className="text-[12px] uppercase tracking-[0.25em] text-muted-foreground/70 mb-6">
                    Бесплатный лонгрид
                  </p>
                  <div className="mb-8 flex justify-center">
                    <NatalChartArt birthDate={user?.birth_date} className="w-full max-w-[340px] h-auto" />
                  </div>
                  <div className="space-y-4">
                    {renderLongreadBody(openTopic.body, {
                      name: user?.display_name,
                      sign: user?.birth_date ? getZodiacSign(user.birth_date).name : "",
                      symbol: user?.birth_date ? getZodiacSign(user.birth_date).symbol : "",
                    }).map((paragraph, i) => (
                      <p key={i} className="text-[15px] leading-[1.75] text-foreground/90">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </>
              ) : (
                (() => {
                  const paragraphs = renderLongreadBody(openTopic.body, {
                    name: user?.display_name,
                    sign: user?.birth_date ? getZodiacSign(user.birth_date).name : "",
                    symbol: user?.birth_date ? getZodiacSign(user.birth_date).symbol : "",
                  });
                  const [lead, ...rest] = paragraphs;
                  const middle = rest.slice(0, Math.max(0, rest.length - 1));
                  const closing = rest.length > 0 ? rest[rest.length - 1] : null;
                  return (
                    <>
                      {/* Eyebrow */}
                      <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground/80 mb-4">
                        {openTopic.proOnly ? "Лонгрид · Pro" : "Лонгрид"}
                      </p>

                      {/* Hero mark */}
                      <div className="flex items-center gap-4 mb-6">
                        <div className="text-4xl leading-none">{openTopic.emoji}</div>
                        <div className="h-px flex-1 bg-foreground/15" />
                      </div>

                      {/* Title */}
                      <h2 className="font-serif text-[30px] leading-[1.15] text-foreground mb-3 tracking-tight">
                        {openTopic.title}
                      </h2>
                      <p className="text-[13px] leading-relaxed text-muted-foreground mb-10 max-w-[44ch]">
                        {openTopic.description}
                      </p>

                      {openTopic.image ? (
                        <img
                          src={openTopic.image}
                          alt={openTopic.title}
                          className="block w-full max-w-sm mx-auto rounded-lg border border-border mb-8"
                        />
                      ) : null}

                      {/* Lead paragraph */}
                      {lead && (
                        <p className="font-serif text-[19px] leading-[1.55] text-foreground mb-10">
                          {lead}
                        </p>
                      )}

                      {/* Body */}
                      <div className="space-y-7">
                        {middle.map((paragraph, i) => (
                          <p key={i} className="text-[15.5px] leading-[1.78] text-foreground/90">
                            {paragraph}
                          </p>
                        ))}
                      </div>

                      {/* Closing */}
                      {closing && (
                        <div className="mt-12 pt-8 border-t border-foreground/15">
                          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground mb-3">
                            И в завершение
                          </p>
                          <p className="font-serif italic text-[17px] leading-[1.6] text-foreground/90">
                            {closing}
                          </p>
                        </div>
                      )}

                      {/* End mark */}
                      <div className="mt-12 flex justify-center">
                        <span className="text-muted-foreground/40 tracking-[1em] text-[10px]">— ✦ —</span>
                      </div>
                    </>
                  );
                })()
              )}
            </article>
          </motion.div>
        )}
      </AnimatePresence>

      {revealingId && <LongreadRevealAnimation onComplete={handleRevealComplete} />}
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} variant="longread" />
      <BottomNav />
    </div>
  );
}
