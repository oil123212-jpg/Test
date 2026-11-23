import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../data/dialogue.sqlite', import.meta.url));
const db = new DatabaseSync(file, { readOnly: true });
const topics = db.prepare('SELECT DISTINCT topic FROM cards ORDER BY topic').all().map(row => row.topic);
const intents = db.prepare('SELECT DISTINCT intent FROM cards ORDER BY intent').all().map(row => row.intent);
const byIntent = db.prepare('SELECT scene,strategy,example FROM cards WHERE topic=? AND intent=?');
const byTopic = db.prepare('SELECT scene,strategy,example FROM cards WHERE topic=? ORDER BY hits DESC,intent LIMIT 2');

export const dialogueExampleCount = db.prepare('SELECT count(*) AS count FROM cards').get().count;

export const dialogueTool = {
  type: 'function', name: 'lookup_examples',
  description: '현재 대화에서 파악한 활동과 아이의 의도에 맞는 모모의 응답 예시 조회. 평범한 맞장구는 바로 답한다.',
  parameters: {type:'object', properties:{
    topic:{type:'string', enum:topics}, intent:{type:'string', enum:[...intents,'전체']},
  }, required:['topic','intent'], additionalProperties:false},
};

export function lookupDialogue(call) {
  if (call.name !== dialogueTool.name) return {examples:[]};
  let args;
  try { args = JSON.parse(call.arguments); } catch { return {examples:[]}; }
  if (!topics.includes(args?.topic)) return {examples:[]};
  if (args.intent === '전체') return {examples:byTopic.all(args.topic)};
  if (!intents.includes(args.intent)) return {examples:[]};
  return {examples:byIntent.all(args.topic,args.intent)};
}
