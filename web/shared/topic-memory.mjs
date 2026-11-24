// Only these labels may cross from an utterance into a later session.
const topics = {
  playground:['놀이터','미끄럼틀','그네'], blocks:['블록','블럭'], dinosaur:['공룡','티라노'],
  animals:['동물','강아지','고양이'], drawing:['그림','색칠'], space:['우주','행성','로켓'],
  train:['기차','기관차'], music:['노래','동요'], books:['그림책','동화책','책 읽'],
  rabbitRace:['토끼와 거북이','토끼랑 거북이'], axes:['금도끼','은도끼'], stars:['견우','직녀'],
  dangun:['단군'], snail:['우렁이 색시'], rabbitStory:['토끼전','별주부'],
  puzzle:['퍼즐'], ocean:['바다','물고기'], cooking:['요리','소꿉'], ball:['축구','공놀이'],
};
export const memoryTTL = 48 * 60 * 60 * 1000;
export function classifyTopic(text) {
  if (typeof text !== 'string') return null;
  let selected = null, last = -1;
  for (const [id, words] of Object.entries(topics)) for (const word of words) {
    const i = text.lastIndexOf(word);
    if (i > last) { selected=id; last=i; }
  }
  return selected;
}
export function memoryHint(memory, now=Date.now()) {
  if (!memory || typeof memory.topic !== 'string' || !Object.hasOwn(topics,memory.topic) || !Number.isSafeInteger(memory.at) ||
      memory.at > now || now-memory.at >= memoryTTL) return '';
  return '\n이 브라우저의 지난 대화 주제: '+topics[memory.topic][0]+'. 아이가 이어가고 싶을 때만 참고해. 같은 사람이라고 단정하거나 경험과 세부 사실을 꾸미지 마.';
}
