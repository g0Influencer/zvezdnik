import { useEffect, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Lock, X } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { MainScreenStarBackground } from '@/components/MainScreenStarBackground';
import { DayPicker, formatSelectedDateLabel } from '@/components/DayPicker';
import { useAppStore } from '@/lib/store';
import { haptic, hapticNotification, openLink } from '@/lib/telegram';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionConsent } from '@/components/SubscriptionConsent';
import { Button } from '@/components/ui/button';
import { reachGoal } from '@/lib/metrika';
import { getTipForDate, type DailyTip } from '@/lib/content/daily-tips-source';
import { cn } from '@/lib/utils';

const DETAILED_FREE_LIMIT = 4;
const DETAILED_FREE_USAGE_KEY = 'zvezdnik-detailed-free-usage';

type DetailedFreeUsage = {
  dates: string[];
};

const readDetailedFreeUsage = (): DetailedFreeUsage => {
  if (typeof window === 'undefined') return { dates: [] };
  try {
    const raw = localStorage.getItem(DETAILED_FREE_USAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DetailedFreeUsage;
      if (Array.isArray(parsed.dates)) {
        return { dates: parsed.dates.filter((date) => typeof date === 'string') };
      }
    }
  } catch (e) {
    console.error('Failed to read detailed free usage', e);
  }
  return { dates: [] };
};

export default function Today() {
  const { user } = useAppStore();
  const { toast } = useToast();
  const [tip, setTip] = useState<DailyTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [detailedOpen, setDetailedOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [freeUsage, setFreeUsage] = useState<DetailedFreeUsage>(() => readDetailedFreeUsage());

  const isPro = user?.pro_status === 'active';
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const isToday = isSameDay(selectedDate, new Date());
  const freeUsedCount = freeUsage.dates.length;
  const hasOpenedSelected = freeUsage.dates.includes(selectedDateKey);
  const freeLeft = Math.max(DETAILED_FREE_LIMIT - freeUsedCount, 0);
  const canReadDetailed = isPro || hasOpenedSelected || freeLeft > 0;

  const loadDaily = async () => {
    setLoading(true);
    try {
      const result = await getTipForDate(user?.style, selectedDateKey);
      setTip(result);
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка загрузки', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDaily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.style, selectedDateKey]);

  useEffect(() => {
    reachGoal('daily_advice_open');
  }, []);

  const handleOpenDetailed = () => {
    haptic('light');
    if (!canReadDetailed) {
      reachGoal('paywall_open');
      setPaywallOpen(true);
      return;
    }
    if (!isPro && !hasOpenedSelected) {
      const nextUsage = { dates: [...freeUsage.dates, selectedDateKey].slice(0, DETAILED_FREE_LIMIT) };
      localStorage.setItem(DETAILED_FREE_USAGE_KEY, JSON.stringify(nextUsage));
      setFreeUsage(nextUsage);
    }
    reachGoal('daily_detail_open');
    setDetailedOpen(true);
  };

  const handleCloseDetailed = () => {
    haptic('light');
    setDetailedOpen(false);
  };

  const headline = tip?.title ?? 'Подумай о слове «брак».';
  const bodyText = tip?.shortDescription ?? '';
  const detailedParagraphs = (tip?.fullDescription || bodyText)
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const doItems = tip?.do?.length ? tip.do : ['Добавить перца', 'Флирт', 'Объятия'];
  const dontItems = tip?.dont?.length ? tip.dont : ['Манерничать', 'Сладкие формальности', 'Срываться с обещаний'];

  return (
    <div className="relative isolate min-h-screen pb-24 bg-background text-foreground">
      <MainScreenStarBackground />

      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-20 flex items-center justify-between px-5 pt-14 pb-6"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground">Звёздник</span>
        <button
          onClick={() => {
            haptic('light');
            if (!isToday) {
              setSelectedDate(new Date());
              setDayPickerOpen(false);
            } else {
              setDayPickerOpen((v) => !v);
            }
          }}
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-foreground"
        >
          {isToday ? 'СЕГОДНЯ' : formatSelectedDateLabel(selectedDate)}
          {isToday ? (
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', dayPickerOpen && 'rotate-180')}
            />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </button>
      </motion.header>

      <AnimatePresence>
        {dayPickerOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Закрыть"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDayPickerOpen(false)}
              className="fixed inset-0 z-30 bg-background/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute left-0 right-0 top-[104px] z-40 bg-background border-b border-border py-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
            >
              <DayPicker
                selectedDate={selectedDate}
                onChange={(d) => {
                  setSelectedDate(d);
                  setDayPickerOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="relative z-10 flex items-center justify-center py-40">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tip ? (
        <div className="relative z-10 px-5">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground mb-8"
          >
            {isToday
              ? 'Ваш день — в двух словах'
              : `${format(selectedDate, 'EEEE', { locale: ru })} — в двух словах`}
          </motion.p>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDateKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <h1
                className="font-display text-[32px] leading-[1.12] font-bold tracking-[-0.01em] mb-8 max-w-[320px]"
                style={{ fontFamily: "'Space Grotesk', serif" }}
              >
                {headline}
              </h1>

              <p className="text-[14px] leading-[1.75] text-muted-foreground mb-8 max-w-[340px]">
                {bodyText}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <button
              onClick={handleOpenDetailed}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-foreground border-b border-foreground/40 pb-1 hover:border-foreground transition-colors"
            >
              {!canReadDetailed && <Lock className="h-3 w-3" />}
              Подробнее
              <ChevronRight className="h-3 w-3" />
            </button>
            {!isPro && freeLeft > 0 && (
              <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">
                Бесплатно осталось: {freeLeft}/{DETAILED_FREE_LIMIT}
              </span>
            )}
            {!isPro && freeLeft === 0 && !hasOpenedSelected && (
              <span className="block text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-2">
                Доступно в Pro
              </span>
            )}
          </motion.div>

          <div className="h-px bg-border mb-8" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-2 gap-10 mb-12"
          >
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground mb-5">Стоит</p>
              <ul className="space-y-3">
                {doItems.map((item, i) => (
                  <li key={i} className="text-[14px] font-medium leading-snug text-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground mb-5">Не стоит</p>
              <ul className="space-y-3">
                {dontItems.map((item, i) => (
                  <li key={i} className="text-[14px] font-medium leading-snug text-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mb-8"
          >
            <button
              onClick={() => {
                haptic('light');
                setHowItWorksOpen(true);
              }}
              className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground/70 hover:text-foreground transition-colors border-b border-muted-foreground/20 pb-0.5"
            >
              Как это работает?
            </button>
          </motion.div>
        </div>
      ) : (
        <div className="relative z-10 text-center py-32 px-6">
          <p className="text-muted-foreground text-sm">Не удалось загрузить прогноз</p>
          <Button variant="outline" className="mt-4" onClick={loadDaily}>
            Попробовать снова
          </Button>
        </div>
      )}

      {/* Detailed reader overlay */}
      <AnimatePresence>
        {detailedOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-background overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
              <button
                onClick={handleCloseDetailed}
                className="flex items-center gap-2 px-5 py-4 text-[11px] font-medium uppercase tracking-[0.25em] text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад
              </button>
            </div>
            <article className="px-5 pt-8 pb-32 max-w-2xl mx-auto">
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground mb-6">
                Подробнее · {format(new Date(), 'd MMMM', { locale: ru })}
              </p>
              <h1
                className="font-display text-[28px] leading-[1.15] font-bold tracking-[-0.01em] mb-8"
                style={{ fontFamily: "'Space Grotesk', serif" }}
              >
                {headline}
              </h1>
              <div className="space-y-5 text-[15px] leading-[1.75] text-foreground/90">
                {detailedParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <p className="text-muted-foreground italic">
                  Звёзды описывают оптику, а не сценарий. Решение всегда за тобой.
                </p>
              </div>
            </article>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paywall */}
      <AnimatePresence>
        {paywallOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setPaywallOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-background border border-border p-8"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground text-center mb-4">
                Только для Pro
              </p>
              <h3
                className="font-display text-[22px] leading-tight font-bold text-center mb-4"
                style={{ fontFamily: "'Space Grotesk', serif" }}
              >
                Подробный разбор каждый день
              </h3>
              <p className="text-[14px] leading-relaxed text-muted-foreground text-center mb-8">
                Ты уже прочитал(а) 4 бесплатных подробных разбора. Чтобы открывать детали каждый день, оформи
                PRO-подписку — 299 ₽/мес.
              </p>
              <div className="mb-4">
                <SubscriptionConsent checked={consented} onChange={setConsented} />
              </div>
              <button
                onClick={async () => {
                  if (!consented) return;
                  haptic('medium');
                  try {
                    const res = await api.createPayment('monthly_pro', consented);
                    openLink(res.payment_url);
                    setPaywallOpen(false);
                  } catch {
                    hapticNotification('error');
                    toast({ title: 'Не удалось открыть оплату', variant: 'destructive' });
                  }
                }}
                disabled={!consented}
                className="w-full bg-foreground text-background text-[11px] font-semibold uppercase tracking-[0.25em] py-4 hover:bg-foreground/90 transition-colors mb-3 disabled:opacity-60"
              >
                Оформить PRO — 299 ₽/мес
              </button>
              <button
                onClick={() => setPaywallOpen(false)}
                className="w-full text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground py-3 hover:text-foreground transition-colors"
              >
                Не сейчас
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works modal */}
      <AnimatePresence>
        {howItWorksOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background overflow-y-auto overscroll-contain"
            onClick={() => setHowItWorksOpen(false)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative min-h-full w-full px-7 pt-16 pb-32"
            >
              <button
                onClick={() => {
                  haptic('light');
                  setHowItWorksOpen(false);
                }}
                className="fixed top-5 right-5 z-10 p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>

              <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground mb-5">
                Как это работает
              </p>
              <h3
                className="font-display text-[22px] leading-[1.2] font-bold tracking-[-0.01em] mb-6"
                style={{ fontFamily: "'Space Grotesk', serif" }}
              >
                Твои звёзды давно ждали
              </h3>

              <div className="space-y-5 text-[14px] leading-[1.7] text-foreground/85">
                <p>
                  По дате, времени и месту рождения мы строим вашу персональную натальную карту — точный снимок неба в
                  момент, когда вы появились на свет. Это ваш астрологический отпечаток.
                </p>
                <p>
                  Каждое утро мы сверяем сегодняшнее положение планет с вашей картой: где Луна задевает ваши чувства, где
                  Меркурий ускоряет мысли, где Марс подталкивает к действию. Из этих транзитов и складывается ваш день.
                </p>
                <p>
                  «Стоит» и «Не стоит» — это не запреты, а оптика. Подсказки, в каком направлении энергия дня работает на
                  вас, а где лучше не настаивать.
                </p>
                <p>
                  Подробный разбор раскрывает за этим механику: какие именно аспекты сегодня активны, как они
                  взаимодействуют с вашими натальными планетами и что с этим делать.
                </p>
                <p className="text-muted-foreground italic">Доверься своим звездам и они покажут путь</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
