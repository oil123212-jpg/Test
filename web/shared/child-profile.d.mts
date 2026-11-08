export const PARENT_SETTINGS_POLICY: 'parent-settings-v2';
export interface ChildProfile { version: 1; name: string; age: number; interests: string[]; }
export interface Interest { id: string; label: string; icon: string; }
export const INTEREST_GROUPS: ReadonlyArray<{label:string;icon:string;items:ReadonlyArray<Interest>}>;
export const INTERESTS: ReadonlyArray<Interest>;
export function parseChildProfile(value: unknown): ChildProfile;
