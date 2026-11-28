// Korean space-delimited words (어절); normalize punctuation, not meaning.
export const STORY_WORD_RATIO = 0.65;
const words = text => text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function createStoryMatcher(cue) {
  const expected = words(cue);
  const required = Math.ceil(expected.length * STORY_WORD_RATIO);
  // Incremental longest common subsequence. A spoken word counts at most once;
  // missing or unrelated words can be skipped, but order still matters.
  const matches = new Uint16Array(expected.length + 1);
  return {
    accept(finalTranscript) {
      for (const token of words(finalTranscript)) {
        let previous = 0;
        for (let i = 1; i <= expected.length; i++) {
          const old = matches[i];
          matches[i] = token === expected[i - 1]
            ? previous + 1 : Math.max(old, matches[i - 1]);
          previous = old;
        }
      }
      return required > 0 && matches[expected.length] >= required;
    },
  };
}
