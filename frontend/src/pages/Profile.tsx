import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BottomNav } from '@/components/BottomNav';
import { useAppStore } from '@/lib/store';
import { getZodiacSign, STYLE_LABELS } from '@/lib/zodiac';
import { api } from '@/lib/api';
import { haptic, hapticNotification } from '@/lib/telegram';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AREAS } from '@/lib/onboarding-config';
import { fetchSheet, clearSheetCache } from '@/lib/sheets-loader';
import { SHEET_NAMES } from '@/lib/sheets-config';

const STYLE_OPTIONS = ['gentle', 'blunt'];
const NAME_PROMPT_FLAG = 'profile_name_prompted';

export default function Profile() {
  const { user, setUser } = useAppStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [parsingSheets, setParsingSheets] = useState(false);

  const updateField = async (field: string, value: string | boolean | Record<string, unknown>) => {
    if (!user) return;
    haptic('light');
    setSaving(true);
    try {
      const result = await api.updateProfile({ [field]: value });
      setUser(result.user);
      hapticNotification('success');
    } catch (e) {
      console.error(e);
      toast({ title: 'Ошибка', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleParseSheets = async () => {
    haptic('light');
    setParsingSheets(true);
    clearSheetCache();
    toast({ title: 'Загрузка контента из Google Sheets…' });

    const sheets = [
      { name: SHEET_NAMES.daily, label: 'daily_tips' },
      { name: SHEET_NAMES.longreads, label: 'longreads' },
      { name: SHEET_NAMES.weeklyLongreads, label: 'weekly_longreads' },
      { name: SHEET_NAMES.void, label: 'void_questions' },
    ];

    const results: { label: string; ok: boolean; count: number; error?: string }[] = [];
    for (const s of sheets) {
      try {
        const rows = await fetchSheet(s.name);
        results.push({ label: s.label, ok: true, count: rows.length });
        toast({ title: `${s.label}: ${rows.length} строк загружено` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка';
        results.push({ label: s.label, ok: false, count: 0, error: msg });
        toast({
          title: `${s.label}: не удалось загрузить`,
          description: msg,
          variant: 'destructive',
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    if (okCount === sheets.length) {
      hapticNotification('success');
      toast({ title: 'Контент обновлён', description: `Все ${sheets.length} листа успешно загружены.` });
    } else {
      hapticNotification('error');
      toast({
        title: `Загружено ${okCount} из ${sheets.length}`,
        variant: 'destructive',
      });
    }
    setParsingSheets(false);
  };

  const handleEnablePro = async () => {
    if (!import.meta.env.DEV) {
      toast({ title: 'Подписка скоро будет доступна' });
      return;
    }
    await updateField('pro_status', 'active');
    toast({ title: 'PRO активирован' });
  };

  const handleCancelPro = async () => {
    setCancelOpen(false);
    await updateField('pro_status', 'free');
    toast({ title: 'Подписка отменена' });
  };

  useEffect(() => {
    if (!user) return;
    const alreadyPrompted =
      typeof window !== 'undefined' && localStorage.getItem(NAME_PROMPT_FLAG) === '1';
    if (!user.display_name && !alreadyPrompted) {
      setNamePromptOpen(true);
    }
  }, [user]);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem(NAME_PROMPT_FLAG, '1');
    }
    setNamePromptOpen(false);
    if (trimmed && trimmed !== user?.display_name) {
      await updateField('display_name', trimmed);
      toast({ title: 'Имя обновлено' });
    }
  };

  const openNameEditor = () => {
    haptic('light');
    setNameInput(user?.display_name || '');
    setNamePromptOpen(true);
  };

  const handleSkipName = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NAME_PROMPT_FLAG, '1');
    }
    setNamePromptOpen(false);
  };

  if (!user) return null;

  const zodiac = user.birth_date ? getZodiacSign(user.birth_date) : null;
  const personalization = user.personalization as Record<string, unknown> | null;
  const selectedAreas = (personalization?.selectedAreas as string[]) || [];
  const isPro = user.pro_status === 'active';
  const nextBilling = (() => {
    if (!isPro || !user.pro_activated_at) return null;
    const start = new Date(user.pro_activated_at);
    if (Number.isNaN(start.getTime())) return null;
    const next = new Date(start);
    const today = new Date();
    while (next <= today) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  })();

  return (
    <div className="min-h-screen pb-20">
      <div className="px-5 pt-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card mb-3">
              <span className="text-4xl">{zodiac?.symbol ?? '✨'}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="font-display text-2xl font-bold">{user.display_name || 'Пользователь'}</h1>
              <button
                onClick={openNameEditor}
                aria-label="Изменить имя"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {zodiac?.name} ·{' '}
              {user.birth_date ? format(new Date(user.birth_date), 'd MMM yyyy', { locale: ru }) : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.birth_place}</p>
          </div>

          {/* Subscription */}
          <div className="rounded-2xl border border-border bg-card p-4 mb-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Подписка</p>
                <p className="font-display font-semibold mt-0.5">{isPro ? 'PRO ⭐' : 'FREE'}</p>
                {isPro && nextBilling && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Следующее списание {format(nextBilling, 'd MMMM yyyy', { locale: ru })}
                  </p>
                )}
              </div>
              {isPro ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    haptic('light');
                    setCancelOpen(true);
                  }}
                  disabled={saving}
                >
                  Отменить подписку
                </Button>
              ) : (
                <Button size="sm" className="rounded-lg" onClick={handleEnablePro} disabled={saving}>
                  Включить PRO
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mb-6 px-1">
            Тестовый режим. Реальная оплата появится позже.
          </p>

          {/* Style */}
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Стиль</p>
            <div className="flex gap-2">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => updateField('style', s)}
                  disabled={saving}
                  className={cn(
                    'flex-1 rounded-xl border py-3 text-sm font-medium transition-all',
                    user.style === s
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl border border-border bg-card p-4 mb-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Уведомления
                </p>
                <p className="text-sm text-muted-foreground">
                  Утренний тизер дня в 9:00 от бота.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg shrink-0"
                disabled={saving}
                onClick={() => updateField('push_enabled', !user.push_enabled)}
              >
                {user.push_enabled ? 'Отключить' : 'Включить'}
              </Button>
            </div>
          </div>

          {/* Support */}
          <div className="rounded-2xl border border-border bg-card p-4 mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Поддержка</p>
            <p className="text-sm text-muted-foreground mb-3">
              Что-то не работает или работает не так? Обязательно пиши нам.
            </p>
            <a
              href="https://t.me/romanverko"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic('light')}
            >
              <Button variant="outline" size="sm" className="rounded-lg">
                Написать в Telegram
              </Button>
            </a>
          </div>

          {/* Personalization */}
          <div className="rounded-2xl border border-border bg-card p-4 mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Персонализация гороскопа
            </p>
            {selectedAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                {selectedAreas.map((id) => {
                  const area = AREAS.find((a) => a.id === id);
                  return area ? (
                    <span key={id} className="text-xs bg-secondary rounded-lg px-2 py-1">
                      {area.emoji} {area.title}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-3">
              Если ваши приоритеты изменились, вы можете заново пройти настройку. Мы обновим акценты в ваших ежедневных
              гороскопах.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => {
                haptic('light');
                navigate('/onboarding?redo=true');
              }}
            >
              Пройти заново
            </Button>
          </div>

          {/* Sheets parsing (dev only) */}
          {import.meta.env.DEV && (
            <div className="rounded-2xl border border-border bg-card p-4 mb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                Контент из Google Sheets
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Принудительно сбросить кэш и заново загрузить листы: daily_tips, longreads, weekly_longreads, void_questions.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={handleParseSheets}
                disabled={parsingSheets}
              >
                {parsingSheets ? 'Парсинг…' : 'Парсить таблицу'}
              </Button>
            </div>
          )}
        </motion.div>
      </div>

      <Dialog
        open={namePromptOpen}
        onOpenChange={(v) => {
          if (!v) handleSkipName();
        }}
      >
        <DialogContent className="border-border bg-background max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[11px] font-medium uppercase tracking-[0.3em] text-foreground text-center">
              Как тебя зовут?
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-relaxed text-muted-foreground text-center pt-3">
              Чтобы обращаться по имени в гороскопах. Можно пропустить — оставим «Пользователь».
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Имя"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveName();
                }
              }}
            />
          </div>
          <DialogFooter className="flex flex-col gap-3 pt-4 sm:flex-col sm:space-x-0">
            <button
              onClick={handleSaveName}
              className="w-full bg-foreground text-background text-[11px] font-semibold uppercase tracking-[0.25em] py-4 hover:bg-foreground/90 transition-colors"
            >
              Сохранить
            </button>
            <button
              onClick={handleSkipName}
              className="w-full text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground py-3 hover:text-foreground transition-colors"
            >
              Пропустить
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="border-border bg-background max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить PRO-подписку?</AlertDialogTitle>
            <AlertDialogDescription>Доступ к платным функциям будет закрыт сразу.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Назад</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelPro}>Отменить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
