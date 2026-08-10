import type { PoliceDef } from '@/types';

export const POLICE: PoliceDef[] = [
  {
    id: 'local_patrol',
    name: 'Local Patrol',
    movement: 1,
    range: 1,
    specialty: 'Raises Property Heat on everything it stands next to.',
    start: { q: 2, r: 0 },
  },
  {
    id: 'vice_squad',
    name: 'Vice Squad',
    movement: 2,
    range: 1,
    specialty: 'Especially dangerous to Unregistered Workers.',
    start: { q: 1, r: 2 },
  },
  {
    id: 'financial_crimes',
    name: 'Financial Crimes Unit',
    movement: 1,
    range: 2,
    specialty: 'Wider enforcement radius; targets Dirty Cash.',
    start: { q: 4, r: 1 },
  },
];

export const POLICE_BY_ID = Object.fromEntries(POLICE.map((p) => [p.id, p]));
