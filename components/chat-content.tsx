import { splitChatMath, renderChatMath } from '@/lib/chat-math';

export function ChatContent({ text }: { text: string }) {
  return <div className="ab-chat-content">{splitChatMath(text).map((part,index) => {
    if (part.latex === undefined) return <span key={index}>{part.text}</span>;
    const html = renderChatMath(part.latex, !!part.display);
    if (html === null) return <span key={index} className="ab-chat-math-fallback" title="수식 형식을 읽지 못해 원문을 표시합니다.">{part.text}</span>;
    return part.display
      ? <div key={index} className="ab-chat-math-block" dangerouslySetInnerHTML={{__html:html}} />
      : <span key={index} className="ab-chat-math-inline" dangerouslySetInnerHTML={{__html:html}} />;
  })}</div>;
}
