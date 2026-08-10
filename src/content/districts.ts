import type { DistrictDef } from '@/types';

export const DISTRICTS: DistrictDef[] = [
  {
    id: 'laneways',
    name: 'Laneways',
    bonus: 'First Unregistered Worker recruited each round costs $50k less',
    properties: [1, 2, 3, 4],
  },
  {
    id: 'waterfront',
    name: 'Waterfront',
    bonus: 'First Big Night each round generates an additional $100k Clean',
    properties: [5, 6, 7, 8],
  },
  {
    id: 'bazaar',
    name: 'Bazaar',
    bonus: 'One Property gains +1 Capacity',
    properties: [9, 10, 11, 12],
  },
  {
    id: 'transit',
    name: 'Transit',
    bonus: 'First Worker movement each turn is free',
    properties: [13, 14, 15, 16],
  },
  {
    id: 'uptown',
    name: 'Uptown',
    bonus: 'Licensed Properties gain +1 Safety',
    properties: [17, 18, 19, 20],
  },
  {
    id: 'old_quarter',
    name: 'Old Quarter',
    bonus: 'First Heat-reduction Action removes one additional Heat',
    properties: [21, 22, 23, 24],
  },
];

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<
  string,
  DistrictDef
>;
