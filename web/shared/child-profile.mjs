export const PARENT_SETTINGS_POLICY = 'parent-settings-v2';
const groups = [
  ['동물·자연','animal',[
    ['animals','동물'],['dinosaurs','공룡'],['insects','곤충'],['ocean','바다 생물'],['forest','숲'],['flowers','꽃'],['gardening','식물 키우기'],['weather','날씨'],
  ]],
  ['우주·탐험','rocket',[
    ['space','우주'],['stars','별'],['moon','달'],['planets','행성'],['rockets','로켓'],['robots','로봇'],['adventure','탐험'],['treasure','보물찾기'],
  ]],
  ['이야기·상상','book',[
    ['fairy_tales','동화'],['picture_books','그림책'],['princesses','공주 이야기'],['dragons','용'],['magic','마법'],['heroes','영웅 놀이'],['pirates','해적 놀이'],['role_play','역할놀이'],
  ]],
  ['만들기·미술','blocks',[
    ['blocks','블록놀이'],['drawing','그림 그리기'],['coloring','색칠하기'],['clay','점토놀이'],['origami','종이접기'],['crafts','만들기'],['stickers','스티커'],['puzzles','퍼즐'],
  ]],
  ['탈것','car',[
    ['cars','자동차'],['trains','기차'],['airplanes','비행기'],['boats','배'],['fire_trucks','소방차'],['excavators','굴착기'],['buses','버스'],['bicycles','자전거'],
  ]],
  ['음악·표현','music',[
    ['singing','노래'],['nursery_rhymes','동요'],['dancing','춤추기'],['instruments','악기'],['rhythm','리듬놀이'],['acting','연극놀이'],['puppets','인형놀이'],['storytelling','이야기 만들기'],
  ]],
  ['몸·바깥놀이','ball',[
    ['balls','공놀이'],['soccer','축구'],['running','달리기'],['jumping','뛰어놀기'],['playground','놀이터'],['sand','모래놀이'],['water','물놀이'],['bubbles','비눗방울'],
  ]],
  ['일상·탐구','sparkles',[
    ['cooking','요리'],['baking','빵 만들기'],['fruits','과일'],['vegetables','채소'],['numbers','숫자놀이'],['letters','글자놀이'],['science','과학놀이'],['board_games','보드게임'],
  ]],
];
export const INTEREST_GROUPS = Object.freeze(groups.map(([label,icon,items]) => Object.freeze({label,icon,items:Object.freeze(items.map(([id,label])=>Object.freeze({id,label,icon})))})));
export const INTERESTS = Object.freeze(INTEREST_GROUPS.flatMap(group=>group.items));
const allowed = new Set(INTERESTS.map(item=>item.id));
export function parseChildProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key=>!['version','name','age','interests'].includes(key)) ||
      value.version !== 1 || typeof value.name !== 'string' || value.name.length > 60 ||
      !Number.isInteger(value.age) || value.age < 3 || value.age > 6 ||
      !Array.isArray(value.interests) || value.interests.length > INTERESTS.length ||
      value.interests.some(id=>typeof id !== 'string' || !allowed.has(id))) throw new Error('INVALID_PROFILE');
  const name = value.name.normalize('NFC').trim().replace(/ +/g,' ');
  if (!/^[\p{L}\p{M}][\p{L}\p{M} '\-]{0,29}$/u.test(name)) throw new Error('INVALID_PROFILE');
  return {version:1,name,age:value.age,interests:[...new Set(value.interests)].sort()};
}
