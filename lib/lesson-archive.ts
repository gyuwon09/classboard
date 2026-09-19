import { z } from 'zod';
import { boardFrameSchema, sourcePageSchema } from './agent.ts';

export const citationSchema = z.object({ id: z.string(), label: z.string(), text: z.string() });
export const summarySchema = z.object({
  overview: z.string().max(600),
  sections: z.array(z.object({ title: z.string().max(100), body: z.string().max(900), citations: z.array(citationSchema).max(5) })).min(1).max(12),
});
export type LessonSummary = z.infer<typeof summarySchema>;
export const chatMessageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000), citations: z.array(citationSchema).max(8).optional() });
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export const lessonResultSchema = z.object({
  source: z.object({ name: z.string().min(1).max(80), pages: z.array(sourcePageSchema).min(1).max(20) }),
  frames: z.array(boardFrameSchema.extend({ id: z.string(), sourceName: z.string(), createdAt: z.string(), edited: z.boolean().optional() })).max(500),
  transcript: z.array(z.string().max(10000)).max(10000), notices: z.array(z.string()).max(10000),
  startedAt: z.number().finite(), endedAt: z.number().finite(),
});
export const savedLessonSchema = z.object({ version: z.literal(1), id: z.string(), result: lessonResultSchema, summary: summarySchema.optional(), messages: z.array(chatMessageSchema).max(1000) });
export type SavedLesson = z.infer<typeof savedLessonSchema>;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('autoboard-lessons', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('lessons', { keyPath: 'id' });
    request.onerror = () => reject(Error('수업 저장소를 열지 못했습니다. 브라우저 저장 권한을 확인해 주세요.'));
    request.onblocked = () => reject(Error('다른 탭을 닫고 저장을 다시 시도해 주세요.'));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lessons', mode);
    const request = action(tx.objectStore('lessons'));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(Error('수업 기록을 저장하거나 읽지 못했습니다. 저장 공간과 브라우저 권한을 확인해 주세요.')); };
  });
}
export async function saveLesson(lesson: SavedLesson) { await transaction('readwrite', store => store.put(savedLessonSchema.parse(lesson))); }
export async function listLessons() {
  const raw = await transaction<unknown[]>('readonly', store => store.getAll());
  const lessons: SavedLesson[] = []; let invalid = 0;
  for (const item of raw) { const parsed = savedLessonSchema.safeParse(item); if (parsed.success) lessons.push(parsed.data); else invalid++; }
  return { lessons: lessons.sort((a,b) => b.result.endedAt - a.result.endedAt), invalid };
}
