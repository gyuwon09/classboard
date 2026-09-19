"use client";
import { useEffect, useState } from 'react';

export function LiveCaptions({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(Boolean(text.trim()));
    const timeout = setTimeout(() => setVisible(false), 6500);
    return () => clearTimeout(timeout);
  }, [text]);
  return <div className="ab-captions ab-cinema-captions" aria-label="실시간 음성 자막">
    <div className="ab-caption-window" data-visible={visible} aria-hidden={!visible}>
      <p><span>{text}</span></p>
    </div>
  </div>;
}
