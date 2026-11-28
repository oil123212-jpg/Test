export interface ReadingTurn {
  book: string;
  role: string | null;
  narration: [string, string][];
  cue: string;
  finished: boolean;
}
export function createReader(books: Record<string, [string,string][]>): {
  run(raw: string): ReadingTurn | {titles: string[]} | {title: string; roles: string[]} | {error: string} | {stopped: boolean};
  current(): ReadingTurn | undefined;
};
