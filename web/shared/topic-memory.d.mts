export const memoryTTL:number;
export interface TopicMemory { topic:string; at:number }
export function memoryHint(memory:unknown,now?:number):string;
export function classifyTopic(text:unknown):string|null;
