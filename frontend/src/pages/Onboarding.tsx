import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { reachGoal } from '@/lib/metrika';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { haptic, hapticNotification } from '@/lib/telegram';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { AREAS, getAreaById } from '@/lib/onboarding-config';
import { AreaSelectionStep } from '@/components/onboarding/AreaSelectionStep';
import { DynamicQuestionsStep } from '@/components/onboarding/DynamicQuestionsStep';
import { BirthDateStep } from '@/components/onboarding/BirthDateStep';
import { PostOnboardingLoading } from '@/components/PostOnboardingLoading';

const STYLE_OPTIONS = [
  { value: 'gentle', label: 'Мягко', desc: 'Поддержка и забота' },
  { value: 'blunt', label: 'Прямо', desc: 'Без фильтров' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRedo = searchParams.get('redo') === '1' || searchParams.get('redo') === 'true';
  const { user, setUser, setOnboarded } = useAppStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showRitual, setShowRitual] = useState(false);

  // Pre-fill from existing personalization in redo mode
  const existingP = (isRedo && user?.personalization) as Record<string, unknown> | null;

  const [birthDate, setBirthDate] = useState<Date>();
  const [birthTime, setBirthTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState('');
  const [style, setStyle] = useState('gentle');
  const [gender, setGender] = useState<'' | 'male' | 'female'>('');

  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    () => (existingP?.selectedAreas as string[]) || [],
  );
  const [areaAnswers, setAreaAnswers] = useState<Record<string, string>>(() => {
    if (!existingP) return {};
    const answers: Record<string, string> = {};
    AREAS.forEach((a) => {
      const val = existingP[a.fieldName];
      if (typeof val === 'string') answers[a.fieldName] = val;
    });
    return answers;
  });

  // In redo mode, skip birth/style steps (0,1,2) — start at step 3
  const REDO_OFFSET = 3;
  const [step, setStep] = useState(isRedo ? REDO_OFFSET : 0);

  useEffect(() => {
    if (!isRedo) reachGoal('onboarding_open');
  }, [isRedo]);

  const allSteps = ['Дата', 'Время и место', 'Стиль', 'Сферы', 'Детали'];
  const visibleSteps = isRedo ? allSteps.slice(REDO_OFFSET) : allSteps;
  const progressIndex = isRedo ? step - REDO_OFFSET : step;

  const canNext = () => {
    switch (step) {
      case 0:
        return !!birthDate;
      case 1:
        return birthPlace.trim().length >= 2 && !!gender;
      case 2:
        return !!style;
      case 3:
        return selectedAreas.length >= 1;
      case 4:
        return selectedAreas.every((id) => {
          const area = getAreaById(id);
          return area && !!areaAnswers[area.fieldName];
        });
      default:
        return false;
    }
  };

  const buildPersonalization = () => {
    const p: Record<string, unknown> = {
      selectedAreas,
      onboardingCompleted: true,
      onboardingUpdatedAt: new Date().toISOString(),
    };
    selectedAreas.forEach((id) => {
      const area = getAreaById(id);
      if (area && areaAnswers[area.fieldName]) {
        p[area.fieldName] = areaAnswers[area.fieldName];
      }
    });
    return p;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const personalization = buildPersonalization();

      if (isRedo) {
        await api.updateProfile({ personalization });
        const profile = await api.getProfile();
        setUser(profile);
        hapticNotification('success');
        toast({ title: 'Готово', description: 'Мы обновили ваши приоритеты для персонального гороскопа.' });
        navigate('/profile', { replace: true });
      } else {
        if (!birthDate) return;
        await api.onboarding({
          birth_date: format(birthDate, 'yyyy-MM-dd'),
          birth_time: timeUnknown ? '' : birthTime || '',
          birth_place: birthPlace.trim(),
          birth_lat: 0.0,
          birth_lon: 0.0,
          gender,
          style,
          focus: selectedAreas[0] || 'self',
          personalization,
        });
        const profile = await api.getProfile();
        setUser(profile);
        hapticNotification('success');
        setShowRitual(true);
      }
    } catch (e) {
      console.error('Onboarding submit error:', e);
      hapticNotification('error');
      const description = e instanceof Error ? e.message : 'Не удалось сохранить профиль';
      toast({ title: 'Ошибка сохранения', description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    const lastStep = 4;
    if (step < lastStep) {
      haptic('light');
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const back = () => {
    const minStep = isRedo ? REDO_OFFSET : 0;
    if (step > minStep) {
      haptic('light');
      setStep((s) => s - 1);
    } else if (isRedo) {
      navigate('/profile');
    } else {
      navigate('/');
    }
  };

  const toggleArea = (id: string) => {
    setSelectedAreas((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const handleAreaAnswer = (fieldName: string, value: string) => {
    setAreaAnswers((prev) => ({ ...prev, [fieldName]: value }));
  };

  if (showRitual) {
    return (
      <PostOnboardingLoading
        onComplete={() => {
          setOnboarded(true);
          navigate('/today', { replace: true });
        }}
      />
    );
  }

  return (
    <div
      className="flex flex-col px-6 py-4"
      style={{
        minHeight: '100dvh',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={back} className="p-1 -ml-1">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex gap-1.5">
          {visibleSteps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 w-8 rounded-full transition-colors',
                i <= progressIndex ? 'bg-foreground' : 'bg-secondary',
              )}
            />
          ))}
        </div>
        <div className="w-5" />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && <BirthDateStep birthDate={birthDate} onDateChange={setBirthDate} />}

            {step === 1 && (
              <div>
                <h2 className="font-display text-2xl font-bold mb-2">Время и место</h2>
                <p className="text-sm text-muted-foreground mb-6">Это уточнит твой прогноз</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Пол</label>
                    <div className="flex gap-3">
                      {[
                        { value: 'male' as const, label: '♂ Мужской' },
                        { value: 'female' as const, label: '♀ Женский' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            haptic('light');
                            setGender(opt.value);
                          }}
                          className={cn(
                            'flex-1 rounded-xl border p-3 text-center text-sm font-medium transition-all',
                            gender === opt.value
                              ? 'border-foreground bg-foreground/5'
                              : 'border-border hover:border-foreground/30',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Время рождения</label>
                    <Input
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                      disabled={timeUnknown}
                      className="h-12"
                      placeholder="12:00"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox
                        id="time-unknown"
                        checked={timeUnknown}
                        onCheckedChange={(v) => {
                          setTimeUnknown(!!v);
                          if (v) setBirthTime('');
                        }}
                      />
                      <label htmlFor="time-unknown" className="text-sm text-muted-foreground cursor-pointer">
                        Не знаю точное время
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Город рождения</label>
                    <Input
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      placeholder="Москва"
                      className="h-12"
                      maxLength={100}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="font-display text-2xl font-bold mb-2">Как с тобой говорить?</h2>
                <p className="text-sm text-muted-foreground mb-6">Это повлияет на тон сообщений</p>
                <div className="space-y-3">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        haptic('light');
                        setStyle(opt.value);
                      }}
                      className={cn(
                        'w-full rounded-xl border p-4 text-left transition-all',
                        style === opt.value
                          ? 'border-foreground bg-foreground/5'
                          : 'border-border hover:border-foreground/30',
                      )}
                    >
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={style}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 rounded-xl bg-secondary/50 p-4"
                  >
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Пример:</p>
                    <p className="text-sm italic text-muted-foreground leading-relaxed whitespace-pre-line">
                      {style === 'gentle'
                        ? 'Тёплое послесвечение тригона марса зовёт приглушить свет и включить заботу о теле. Прогулка по тихим улицам или 20 минут йоги дадут выход остаточному огню.'
                        : 'Сегодня не про «успеть». Сегодня про «сбавить обороты». Пройдись без музыки. Подыши. Вернись в себя.\n\nУм хочет разбор полётов. Игнорируй. Сначала — мягкость: душ, крем, чистая футболка.'}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {step === 3 && (
              <AreaSelectionStep selectedAreas={selectedAreas} onToggle={toggleArea} />
            )}

            {step === 4 && (
              <DynamicQuestionsStep
                selectedAreas={selectedAreas}
                answers={areaAnswers}
                onAnswer={handleAreaAnswer}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky bottom button */}
      <div
        className="sticky bottom-0 bg-background pt-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        <Button
          size="lg"
          className="w-full h-12 text-base font-semibold rounded-xl"
          disabled={!canNext() || loading}
          onClick={next}
        >
          {loading ? 'Сохраняем...' : step < 4 ? 'Далее' : 'Готово'}
        </Button>
      </div>
    </div>
  );
}
