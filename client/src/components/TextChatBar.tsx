import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface TextChatBarProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

const SAMPLE_CHIPS = [
  'بدي شاورما دجاج وحدة وبطاطا مقلية',
  '2 شاورما لحمة مع توم وكبيس زيادة',
  'سندويش فلافل مع طحينة وحمص',
  'طلب دليفري على شارع الحمرا بيروت',
  'احسبلي المجموع وخلّينا نأكّد الطلب',
  'أكيد ثبّت الطلب',
];

export const TextChatBar: React.FC<TextChatBarProps> = ({ onSendMessage, disabled }) => {
  const [inputText, setInputText] = useState('');

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleChipClick = (chip: string) => {
    if (disabled) return;
    onSendMessage(chip);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Quick Suggestions Chips */}
      <div className="chips-scroll">
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
          <Sparkles size={12} className="text-orange-400" />
          أمثلة سريعة:
        </span>
        {SAMPLE_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            className="chip-btn"
            onClick={() => handleChipClick(chip)}
            disabled={disabled}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Main Text Input Form */}
      <form onSubmit={handleSend} className="text-chat-bar">
        <input
          type="text"
          className="text-input-field"
          placeholder="اكتب طلبك باللبناني (مثال: شاورما دجاج مع بطاطا)..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={disabled}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ padding: '12px 20px', borderRadius: 12 }}
          disabled={!inputText.trim() || disabled}
          title="Send message"
        >
          <Send size={18} />
          <span>إرسال</span>
        </button>
      </form>
    </div>
  );
};
