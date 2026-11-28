import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryMatcher } from '../shared/story-match.mjs';
const line = '나는 저 고개까지 깡충깡충 달려갈 수 있어!';
test('accepts five of seven ordered words, split across finalized phrases', () => {
  const m = createStoryMatcher(line);
  assert.equal(m.accept('나는 저 음 고개까지'), false);
  assert.equal(m.accept('달려갈 있어.'), true);
});
test('rejects unrelated, reversed, repeated or insufficient words', () => {
  for (const text of ['우리 함께 출발하자', '있어 수 달려갈 깡충깡충 고개까지 저 나는', '나는 나는 나는 나는 나는', '나는 저 달려갈 있어']) {
    assert.equal(createStoryMatcher(line).accept(text), false);
  }
});
test('normalizes punctuation, rounds up on short lines and never matches empty source', () => {
  assert.equal(createStoryMatcher('우리 가자!').accept('가자'), false);
  assert.equal(createStoryMatcher('우리 가자!').accept('우리, 가자.'), true);
  assert.equal(createStoryMatcher('').accept('아무 말'), false);
});
