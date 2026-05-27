import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CompatibilityLoading } from '@/components/CompatibilityLoading';
import { WheelDatePicker } from '@/components/WheelDatePicker';
import { Paywall } from '@/components/Paywall';
import { useAppStore } from '@/lib/store';
import { api, CompatibilityCardSummary, CompatibilityResult } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MIN_LOADING_MS = 10_000;

type View = 'list' | 'form' | 'loading' | 'result' | 'error';

interface FormState {
  birthDate: Date | undefined;
  birthTime: string;
  birthTimeUnknown: boolean;
  birthPlace: string;
  birthPlaceUnknown: boolean;
  gender: 'female' | 'male' | null;
  includeLove: boolean;
}

const EMPTY_FORM: FormState = {
  birthDate: undefined,
  birthTime: '',
  birthTimeUnknown: false,
  birthPlace: '',
  birthPlaceUnknown: false,
  gender: null,
  includeLove: false,
};

export default function CompatibilityPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAppStore();
  const isPro = user?.pro_status === 'active';

  const [view, setView] = useState<View>('list');
  const [history, setHistory] = useState<CompatibilityCardSummary[]>([]);
  const [remaining, setRemaining] = useState<number>(0);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<CompatibilityResult | null>(null);

  useEffect(() => {
    if (!isPro) {
      setPaywallOpen(true);
      return;
    }
    loadHistory();
  }, [isPro]);

  const loadHistory = async () => {
    try {
      const res = await api.getCompatibilityHistory();
      setHistory(res.cards || []);
      setRemaining(res.remaining ?? 0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBack = () => {
    haptic('light');
    if (view === 'list') {
      navigate('/profile');
    } else {
      setView('list');
      setResult(null);
    }
  };

  const handleNewCard = () => {
    if (remaining <= 0) {
      toast({
        title:
          'Ты уже посмотрел 10 карт в этом месяце. Новые карты откроются в следующем месяце. Сохранённые разборы остаются доступны.',
      });
      return;
    }
    haptic('light');
    setForm({ ...EMPTY_FORM, birthDate: new Date(1995, 5, 15) });
    setView('form');
  };

  const canSubmit =
    !!form.birthDate &&
    !!form.gender &&
    (form.birthTimeUnknown || /^\d{2}:\d{2}$/.test(form.birthTime)) &&
    (form.birthPlaceUnknown || form.birthPlace.trim().length > 0);

  const runGeneration = async (state: FormState) => {
    if (!state.birthDate || !state.gender) return;
    setView('loading');
    haptic('medium');

    const minDelay = new Promise((r) => setTimeout(r, MIN_LOADING_MS));

    try {
      const [resp] = await Promise.all([
        api.generateCompatibility({
          other_birth_date: format(state.birthDate, 'yyyy-MM-dd'),
          other_birth_time: state.birthTimeUnknown ? null : state.birthTime || null,
          other_birth_place: state.birthPlaceUnknown ? null : state.birthPlace.trim() || null,
          other_gender: state.gender,
          include_love: state.includeLove,
        }),
        minDelay,
      ]);

      setRemaining(resp.remaining);
      await loadHistory();
      setResult(resp.card.result);
      setView('result');
      haptic('light');
    } catch (e) {
      console.error(e);
      await minDelay;
      setView('error');
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    runGeneration(form);
  };

  const handleRetry = () => {
    runGeneration(form);
  };

  const openSavedCard = async (id: number) => {
    haptic('light');
    try {
      const card = await api.getCompatibilityCard(id);
      setResult(card.result);
      setView('result');
    } catch (e) {
      console.error(e);
      toast({ title: 'Не удалось открыть разбор', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen pb-28 bg-background text-foreground">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.2em] text-foreground hover:text-foreground/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 pt-6"
          >
            <h1 className="text-[11px] font-medium uppercase tracking-[0.3em] mb-3">
              Карты других людей
            </h1>
            <p className="text-[14px] leading-relaxed text-muted-foreground mb-3">
              Составь портрет другого человека по его натальной карте и посмотри вашу совместимость.
            </p>
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70 mb-6">
              PRO · осталось {remaining} из 10 в этом месяце
            </p>

            <Button
              variant="outline"
              className="w-full h-12 rounded-xl mb-6"
              onClick={handleNewCard}
              disabled={!isPro}
            >
              <Plus className="h-4 w-4 mr-2" />
              Новая карта
            </Button>

            {history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">Пока нет сохранённых разборов</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Составь первый — он останется здесь</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => openSavedCard(card.id)}
                    className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                          {format(new Date(card.created_at), 'd MMM yyyy', { locale: ru })}
                        </p>
                        <p className="text-[14px] font-medium truncate">
                          {card.other_gender === 'female' ? 'Женщина' : 'Мужчина'},{' '}
                          {format(new Date(card.other_birth_date), 'd MMM yyyy', { locale: ru })}
                        </p>
                        {card.other_birth_place && (
                          <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                            {card.other_birth_place}
                          </p>
                        )}
                        {card.compatibility_label && (
                          <p className="text-[12px] text-muted-foreground/80 mt-1 line-clamp-1">
                            {card.compatibility_label}
                          </p>
                        )}
                      </div>
                      {card.compatibility_score != null && (
                        <div className="shrink-0 text-right">
                          <p className="text-[22px] leading-none font-medium">
                            {card.compatibility_score}%
                          </p>
                          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                            совместимость
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {view === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-5 pt-6 max-w-xl mx-auto"
          >
            <h2 className="text-[20px] leading-tight font-medium mb-2">Карта другого человека</h2>
            <p className="text-[13px] text-muted-foreground mb-6">
              Расскажи, кого изучаем — соберём портрет и совместимость.
            </p>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Дата рождения
                </Label>
                <div className="rounded-xl border border-border bg-card px-3 py-3">
                  <WheelDatePicker
                    value={form.birthDate}
                    onChange={(d) => setForm((s) => ({ ...s, birthDate: d }))}
                  />
                  {form.birthDate && (
                    <p className="text-center text-[12px] text-muted-foreground mt-2">
                      {format(form.birthDate, 'd MMMM yyyy', { locale: ru })}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Время рождения
                </Label>
                <Input
                  type="time"
                  value={form.birthTime}
                  onChange={(e) => setForm((s) => ({ ...s, birthTime: e.target.value }))}
                  disabled={form.birthTimeUnknown}
                  className="h-11"
                />
                <label className="flex items-center gap-2 pt-1">
                  <Checkbox
                    checked={form.birthTimeUnknown}
                    onCheckedChange={(v) =>
                      setForm((s) => ({ ...s, birthTimeUnknown: !!v, birthTime: v ? '' : s.birthTime }))
                    }
                  />
                  <span className="text-[13px] text-muted-foreground">Я не знаю время рождения</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Город рождения
                </Label>
                <Input
                  value={form.birthPlace}
                  onChange={(e) => setForm((s) => ({ ...s, birthPlace: e.target.value }))}
                  disabled={form.birthPlaceUnknown}
                  placeholder="Москва"
                  className="h-11"
                />
                <label className="flex items-center gap-2 pt-1">
                  <Checkbox
                    checked={form.birthPlaceUnknown}
                    onCheckedChange={(v) =>
                      setForm((s) => ({ ...s, birthPlaceUnknown: !!v, birthPlace: v ? '' : s.birthPlace }))
                    }
                  />
                  <span className="text-[13px] text-muted-foreground">Я не знаю город рождения</span>
                </label>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Пол
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(['female', 'male'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, gender: g }))}
                      className={cn(
                        'h-11 rounded-md border text-[13px] transition-colors',
                        form.gender === g
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-card text-foreground hover:border-foreground/30',
                      )}
                    >
                      {g === 'female' ? 'Женский' : 'Мужской'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 cursor-pointer">
                <Checkbox
                  checked={form.includeLove}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, includeLove: !!v }))}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-[13px] font-medium">Добавить любовную совместимость</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Отдельный блок про вашу динамику в близости.
                  </p>
                </div>
              </label>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full h-12 rounded-xl text-[12px] uppercase tracking-[0.25em]"
              >
                Составить разбор
              </Button>
              <p className="text-[11px] text-center text-muted-foreground/70">
                Осталось {remaining} из 10 в этом месяце
              </p>
            </div>
          </motion.div>
        )}

        {view === 'result' && result && (
          <motion.article
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-5 pt-6 pb-16 max-w-2xl mx-auto"
          >
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70 mb-3">
              Карта другого человека
            </p>
            <h2 className="text-[24px] leading-tight font-medium mb-3">{result.title}</h2>
            {result.shortDescription && (
              <p className="text-[14px] leading-relaxed text-muted-foreground mb-6">
                {result.shortDescription}
              </p>
            )}

            {typeof result.compatibilityScore === 'number' && (
              <div className="rounded-xl border border-border bg-card p-4 mb-8 flex items-center gap-4">
                <div className="text-[32px] leading-none font-medium">{result.compatibilityScore}%</div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Совместимость
                  </p>
                  {result.compatibilityLabel && (
                    <p className="text-[13px] mt-1">{result.compatibilityLabel}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-8">
              {result.sections?.map((sec, i) => (
                <section key={i}>
                  {sec.title && (
                    <h3 className="text-[16px] font-medium mb-3">
                      {sec.title.replace(/Как он(а)? проявляется в близости/g, 'Как проявляется в близости')}
                    </h3>
                  )}
                  <div className="space-y-3">
                    {sec.text
                      ?.split(/\n\s*\n/)
                      .filter((p) => p.trim())
                      .map((p, j) => (
                        <p key={j} className="text-[15px] leading-[1.75] text-foreground/90">
                          {p}
                        </p>
                      ))}
                  </div>
                </section>
              ))}

              {result.dos?.length > 0 && (
                <section>
                  <h3 className="text-[16px] font-medium mb-3">Что стоит делать</h3>
                  <ul className="space-y-2">
                    {result.dos.map((d, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-foreground/90">
                        — {d}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {result.donts?.length > 0 && (
                <section>
                  <h3 className="text-[16px] font-medium mb-3">Чего лучше избегать</h3>
                  <ul className="space-y-2">
                    {result.donts.map((d, i) => (
                      <li key={i} className="text-[14px] leading-relaxed text-muted-foreground">
                        — {d}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </motion.article>
        )}

        {view === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 pt-20 text-center max-w-md mx-auto"
          >
            <p className="text-[15px] leading-relaxed mb-6">
              Не получилось собрать карту. Попробуй ещё раз чуть позже.
            </p>
            <Button onClick={handleRetry} className="h-12 px-8 rounded-xl">
              <Loader2 className="h-4 w-4 mr-2" />
              Повторить
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {view === 'loading' && <CompatibilityLoading />}

      <Paywall
        open={paywallOpen}
        onClose={() => {
          setPaywallOpen(false);
          if (!isPro) navigate('/profile');
        }}
      />

      <BottomNav />
    </div>
  );
}
