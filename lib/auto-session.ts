export type TranscriptEvent = { type: string; item_id?: string; previous_item_id?: string | null; delta?: string; transcript?: string; error?: { message?: string; code?: string } };

// Audio turns may finish transcription out of order. Never reorder the lesson.
export class TranscriptLedger {
  private order: string[] = [];
  private items = new Map<string, { draft: string; final?: string; delivered: boolean }>();
  private item(id: string) {
    if (!this.items.has(id)) this.items.set(id, { draft: '', delivered: false });
    return this.items.get(id)!;
  }
  ingest(event: TranscriptEvent) {
    const id = event.item_id;
    if (!id) return [] as string[];
    const item = this.item(id);
    if (event.type === 'input_audio_buffer.committed' && !this.order.includes(id)) this.order.push(id);
    if (event.type.endsWith('input_audio_transcription.delta') && item.final === undefined) item.draft += event.delta ?? '';
    if (event.type.endsWith('input_audio_transcription.completed')) item.final = event.transcript ?? '';
    if (event.type.endsWith('input_audio_transcription.failed')) item.final = '';
    const ready: string[] = [];
    for (const key of this.order) {
      const next = this.item(key);
      if (next.delivered) continue;
      if (next.final === undefined) break;
      next.delivered = true;
      if (next.final.trim()) ready.push(next.final.trim());
    }
    return ready;
  }
  get caption() { return [...this.items.values()].filter(i => !i.delivered).map(i => i.final ?? i.draft).join(' ').slice(-400); }
  get pending() { return this.order.filter(id => !this.item(id).delivered).length; }
}

export class SerialLessonQueue<T> {
  private tasks: { text: string; revision: number }[] = [];
  private revision = 0;
  private working = false;
  private controller: AbortController | null = null;
  private waiters: (() => void)[] = [];
  private process: (text: string, signal: AbortSignal) => Promise<T>;
  private receive: (result: T, text: string) => void;
  private failed: (error: unknown, text: string) => void;
  private changed: (size: number) => void;
  constructor(process: (text: string, signal: AbortSignal) => Promise<T>, receive: (result: T, text: string) => void, failed: (error: unknown, text: string) => void, changed: (size: number) => void = () => {}) { this.process = process; this.receive = receive; this.failed = failed; this.changed = changed; }
  get size() { return this.tasks.length + (this.working ? 1 : 0); }
  enqueue(text: string) {
    for (let start = 0; start < text.length; start += 1800) this.tasks.push({ text: text.slice(start, start + 1800), revision: this.revision });
    this.changed(this.size); void this.pump();
  }
  private async pump() {
    if (this.working) return;
    this.working = true;
    while (this.tasks.length) {
      const task = this.tasks.shift()!;
      this.controller = new AbortController(); this.changed(this.size);
      try { const result = await this.process(task.text, this.controller.signal); if (task.revision === this.revision) this.receive(result, task.text); }
      catch (error) { if (task.revision === this.revision) this.failed(error, task.text); }
    }
    this.working = false; this.controller = null; this.changed(0);
    this.waiters.splice(0).forEach(resolve => resolve());
  }
  cancel() { this.revision++; this.tasks = []; this.controller?.abort(); this.changed(this.size); }
  drain() { return !this.working && !this.tasks.length ? Promise.resolve() : new Promise<void>(resolve => this.waiters.push(resolve)); }
}
