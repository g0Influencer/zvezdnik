import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/BottomNav';
import { api, ChartData } from '@/lib/api';
import { toast } from 'sonner';

const zodiacSymbols: Record<string, string> = {
  Aries: '\u2648', Taurus: '\u2649', Gemini: '\u264A', Cancer: '\u264B',
  Leo: '\u264C', Virgo: '\u264D', Libra: '\u264E', Scorpio: '\u264F',
  Sagittarius: '\u2650', Capricorn: '\u2651', Aquarius: '\u2652', Pisces: '\u2653',
};

const planetEmojis: Record<string, string> = {
  'Sun': '\u2609', 'Moon': '\u263D', 'Mercury': '\u263F', 'Venus': '\u2640',
  'Mars': '\u2642', 'Jupiter': '\u2643', 'Saturn': '\u2644', 'Uranus': '\u2645',
  'Neptune': '\u2646', 'Pluto': '\u2647', 'North Node': '\u260A', 'South Node': '\u260B',
  'Chiron': '\u26B7', 'Lilith': '\u26B8',
};

export default function ChartPage() {
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'planets'>('chart');

  useEffect(() => {
    api.getChart()
      .then(setChart)
      .catch(() => toast.error('Не удалось загрузить карту'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="flex items-center justify-center py-20">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="min-h-screen pb-20">
        <div className="px-5 pt-6">
          <h1 className="font-display text-2xl font-bold mb-4">Твоя карта</h1>
          <p className="text-muted-foreground">Натальная карта пока не создана. Пройдите онбординг.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="px-5 pt-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="font-display text-2xl font-bold mb-1">Твоя карта</h1>
          <p className="text-sm text-muted-foreground mb-5">
            {chart.ascendant && `Асцендент — ${chart.ascendant}`}
          </p>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border border-border rounded-lg p-1">
            {(['chart', 'planets'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium uppercase tracking-wider rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground'
                }`}
              >
                {tab === 'chart' ? 'Колесо' : 'Планеты'}
              </button>
            ))}
          </div>

          {/* Chart Wheel */}
          {activeTab === 'chart' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {chart.svg ? (
                <div
                  className="w-full aspect-square rounded-2xl overflow-hidden bg-card mb-6"
                  dangerouslySetInnerHTML={{ __html: chart.svg }}
                />
              ) : (
                <div className="w-full aspect-square rounded-2xl bg-card flex items-center justify-center mb-6">
                  <p className="text-muted-foreground">SVG карты недоступен</p>
                </div>
              )}

              {/* Quick info */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <InfoCard label="Асцендент" value={chart.ascendant || '—'} />
              </div>
            </motion.div>
          )}

          {/* Planets Table */}
          {activeTab === 'planets' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="space-y-2">
                {chart.planets.map((planet, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 px-4 rounded-xl bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-6 text-center">
                        {planetEmojis[planet.name_en] || '\u2b50'}
                      </span>
                      <div>
                        <div className="font-medium text-sm">
                          {planet.name}
                          {planet.retro && (
                            <span className="ml-1.5 text-xs text-orange-400">R</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {planet.degree}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm flex items-center gap-1.5 justify-end">
                        <span>{zodiacSymbols[planet.sign] || ''}</span>
                        <span>{planet.sign_ru}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {planet.house} дом
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="font-medium text-sm">{value}</div>
    </div>
  );
}
