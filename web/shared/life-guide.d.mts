export type LifeActivity = 'meal' | 'sleep' | 'tidy';
export interface LifeGuide { version: 1; enabled: boolean; timeZone: string; slots: Record<LifeActivity, number[]>; }
export const LIFE_ACTIVITIES: Readonly<Record<LifeActivity, string>>;
export function emptyLifeGuide(): LifeGuide;
export function parseLifeGuide(value: unknown): LifeGuide;
export function slotLabel(slot: number): string;
export class LifeGuidePlanner {
  constructor(guide?: LifeGuide, random?: () => number);
  update(guide: LifeGuide): void;
  nextCue(now?: Date): { activity: LifeActivity; label: string; time: string } | null;
}
