import { Member } from '@/types/database';

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'm1',
    name: 'Haris',
    order_index: 0,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Haris&top=shortHair&hairColor=black&facialHair[]=beardLight&skinColor=tanned',
    avatar_color: '#a855f7',
    status_aktif: true,
    joined_at: '2026-01-01',
  },
  {
    id: 'm2',
    name: 'Fahrul',
    order_index: 1,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Fahrul&top=shortCurly&hairColor=brown&skinColor=light',
    avatar_color: '#3b82f6',
    status_aktif: true,
    joined_at: '2026-01-01',
  },
  {
    id: 'm3',
    name: 'Ishom',
    order_index: 2,
    avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ishom&top=shortFlat&hairColor=black&skinColor=yellow',
    avatar_color: '#10b981',
    status_aktif: true,
    joined_at: '2026-01-01',
  },
];

