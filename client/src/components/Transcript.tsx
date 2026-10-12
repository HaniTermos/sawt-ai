import React, { useEffect, useRef } from 'react';
import { MessageSquare, User, Bot, Wrench } from 'lucide-react';
import { ChatMessage } from '../types.js';

interface TranscriptProps {
  messages: ChatMessage[];
  streamingAiText?: string;
}

export const Transcript: React.FC<TranscriptProps> = ({ messages, streamingAiText }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingAiText]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="transcript-section">
      <div className="transcript-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={16} className="text-orange-400" />
          <h3>Live Conversation Transcript</h3>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {messages.length} messages
        </span>
      </div>

      <div className="transcript-messages" ref={scrollRef}>
        {messages.length === 0 && !streamingAiText ? (
          <div className="empty-cart-state" style={{ padding: '40px 10px' }}>
            <Bot size={32} opacity={0.4} />
            <p style={{ fontSize: '0.88rem' }}>No conversation yet.</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', direction: 'rtl', fontFamily: 'var(--font-arabic)' }}>
              اضغط على "Start Conversation" أو أرسل رسالة لتجربة التحدث باللهجة اللبنانية مع مساعد مطعم بيتنا!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="message-bubble message-system">
                  {msg.toolEvent && <Wrench size={12} style={{ display: 'inline', marginRight: 4 }} />}
                  {msg.text}
                </div>
              );
            }

            const isCustomer = msg.sender === 'customer';

            return (
              <div
                key={msg.id}
                className={`message-bubble ${isCustomer ? 'message-customer' : 'message-ai'}`}
              >
                <div className="message-meta">
                  {isCustomer ? (
                    <>
                      <span>Customer (الزبون)</span>
                      <User size={12} />
                      <span>{formatTime(msg.timestamp)}</span>
                    </>
                  ) : (
                    <>
                      <Bot size={12} />
                      <span>Baytna AI (مساعد بيتنا)</span>
                      <span>{formatTime(msg.timestamp)}</span>
                    </>
                  )}
                </div>

                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {msg.text}
                </div>

                {msg.toolEvent && (
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: '#93c5fd',
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      direction: 'ltr',
                    }}
                  >
                    <Wrench size={10} /> Tool executed: {msg.toolEvent}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Live streaming bubble for AI voice speech transcript */}
        {streamingAiText && (
          <div className="message-bubble message-ai" style={{ opacity: 0.9 }}>
            <div className="message-meta">
              <Bot size={12} />
              <span>Baytna AI Speaking (حي)...</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {streamingAiText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
