import { loadBooks } from './book-store.mjs';
import { createReader as createBookReader } from '../shared/reader.mjs';

export const readingTool = {
  type:'function', name:'role_reading',
  description:'모든 책 낭독은 이 DB 도구로 시작한다. 책 읽자/읽어줘는 read. 제목이 없으면 book을 생략하고, 지정하면 요청한 제목 그대로 전달한다. 번갈아 읽자는 요청에는 start. 생략한 책과 배역은 자동 선택한다. 목록을 요청하면 choose.',
  parameters:{type:'object', properties:{
    action:{type:'string',enum:['read','choose','start','next','repeat','solo','stop']},
    book:{type:'string',description:'아이가 직접 말한 제목. 없으면 생략'},
    role:{type:'string',description:'아이가 선택한 등장인물 이름'},
  },required:['action'],additionalProperties:false},
};

export function createReader(load = loadBooks) {
  let reader;
  return {
    run(raw) {
      try { reader ??= createBookReader(load()); }
      catch { return {error:'지금은 책장을 열 수 없어. 잠시 후 다시 읽자.'}; }
      return reader.run(raw);
    },
    current() { return reader?.current(); },
  };
}
