import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

export default function FriendsPage() {
  return (
    <div className="min-h-screen pb-20">
      <div className="px-5 pt-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="font-display text-2xl font-bold mb-1">Друзья</h1>

          <div className="flex flex-col items-center justify-center py-20">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Скоро появится</p>
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
