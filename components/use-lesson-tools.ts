"use client";
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

type Snapshot = { mode: string; step: number; playing: boolean; title: string };
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
      try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => console.warn('Classboard browser tools are unavailable.')); }
      catch { console.warn('Classboard browser tools are unavailable.'); }
    };
    register({ name: 'get_lesson_state', title: '수업 진행 상태 확인', description: '현재 수업 방식과 예제의 표시 단계, 자동 진행 여부를 읽습니다. 교사의 입력이나 자료 내용은 반환하지 않습니다.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw Error('빈 객체를 입력해 주세요.');
      return { ...current.current.snapshot };
    } });
    register({ name: 'navigate_example_step', title: '예제 판서 단계 이동', description: '예제 수업에서 지정한 1~6단계로 이동하고 자동 진행을 멈춥니다. 실시간 AI 수업 중에는 사용할 수 없습니다.', inputSchema: { type: 'object', properties: { step: { type: 'integer', minimum: 1, maximum: 6 } }, required: ['step'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'step')) throw Error('step만 입력해 주세요.');
      const step = (input as { step?: unknown }).step;
      if (typeof step !== 'number' || !Number.isInteger(step) || step < 1 || step > 6) throw Error('단계는 1~6 사이의 정수여야 합니다.');
      if (current.current.snapshot.mode !== 'example') throw Error('지구 탈출 속도 예제 탭을 먼저 선택해 주세요.');
      flushSync(() => current.current.navigate(step - 1));
      return { ...current.current.snapshot };
    } });
    return () => lifecycle.abort();
  }, []);
}
