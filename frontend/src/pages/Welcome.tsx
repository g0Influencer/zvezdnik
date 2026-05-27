import { useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { haptic, hapticNotification } from '@/lib/telegram';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export default function Welcome() {
  const navigate = useNavigate();
  const { setUser, setOnboarded } = useAppStore();
  const { toast } = useToast();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skipping, setSkipping] = useState(false);

  const handleStarTap = async () => {
    if (!import.meta.env.DEV) return;
    if (skipping) return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 1500);

    if (tapCountRef.current < 3) return;

    tapCountRef.current = 0;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    setSkipping(true);
    hapticNotification('success');
    try {
      await api.onboarding({
        birth_date: '1995-06-15',
        birth_time: '12:00',
        birth_place: 'Москва',
        birth_lat: 0,
        birth_lon: 0,
        gender: 'female',
        style: 'gentle',
        focus: 'self',
        personalization: {
          selectedAreas: ['self'],
          onboardingCompleted: true,
          onboardingUpdatedAt: new Date().toISOString(),
          debugSkip: true,
        },
      });
      const profile = await api.getProfile();
      setUser(profile);
      setOnboarded(true);
      toast({ title: 'Дебаг-режим', description: 'Онбординг пропущен с шаблонными настройками.' });
      navigate('/today', { replace: true });
    } catch (e) {
      console.error('Debug skip error:', e);
      toast({
        title: 'Не удалось пропустить',
        description: e instanceof Error ? e.message : 'Ошибка',
        variant: 'destructive',
      });
      setSkipping(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center text-center"
      >
        <motion.button
          type="button"
          onClick={handleStarTap}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card active:scale-95 transition-transform"
          aria-label="Логотип"
        >
          <Star className="h-10 w-10" strokeWidth={1.5} />
        </motion.button>

        <h1 className="font-display text-4xl font-bold tracking-tight mb-3">Звездник AI</h1>
        <p className="text-muted-foreground text-base max-w-[280px] mb-12 leading-relaxed">
          Твой ежедневный астро-гид.{'\n'}Коротко. Честно. Лично.
        </p>

        <Button
          size="lg"
          className="w-full max-w-[280px] h-12 text-base font-semibold rounded-xl"
          disabled={skipping}
          onClick={() => {
            haptic('medium');
            navigate('/onboarding');
          }}
        >
          {skipping ? 'Пропускаем…' : 'Начать'}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">​</p>
      </motion.div>
    </div>
  );
}
