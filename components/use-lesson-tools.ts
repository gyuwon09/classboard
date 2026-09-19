"use client";
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

type Snapshot = { mode: string; step: number; playing: boolean; title: string; count: number };
type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };
type ModelContext = { registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => void | Promise<void> };
export function useLessonTools(snapshot: Snapshot, navigate: (step: number) => void) {
  const current = useRef({ snapshot, navigate });
  current.current = { snapshot, navigate };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Tool) => {
      try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => console.warn('autoboard browser tools are unavailable.')); }
      catch { console.warn('autoboard browser tools are unavailable.'); }
    };
    register({ name: 'get_lesson_state', title: '수업 진행 상태 확인', description: '표시 중인 판서 페이지와 전체 개수, 음성 인식 상태를 읽습니다. 음성 인식 문장이나 자료 내용은 반환하지 않습니다.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw Error('빈 객체를 입력해 주세요.');
      return { ...current.current.snapshot };
    } });
    register({ name: 'navigate_board_page', title: '판서 페이지 이동', description: '이미 생성한 판서 페이지로 이동하고 최신 판서 따라가기를 멈춥니다. 녹음이나 AI 요청은 시작하지 않습니다.', inputSchema: { type: 'object', properties: { step: { type: 'integer', minimum: 1 } }, required: ['step'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'step')) throw Error('step만 입력해 주세요.');
      const step = (input as { step?: unknown }).step;
      if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > current.current.snapshot.count) throw Error('이미 생성된 판서 페이지 번호를 입력해 주세요.');
      flushSync(() => current.current.navigate(step - 1));
      return { ...current.current.snapshot };
    } });
    return () => lifecycle.abort();
  }, []);
}
