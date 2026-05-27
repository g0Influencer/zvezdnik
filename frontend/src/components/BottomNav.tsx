import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/telegram';

const tabs = [
  { path: '/today', label: 'Сегодня' },
  { path: '/longreads', label: 'Лонгриды' },
  { path: '/void', label: 'Вселенная' },
  { path: '/profile', label: 'Профиль' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background">
      <div className="mx-auto flex max-w-md items-center justify-between px-3 py-3 pb-8">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => {
                haptic('light');
                navigate(tab.path);
              }}
              className={cn(
                'py-1 text-[9px] font-medium uppercase tracking-[0.12em] transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
