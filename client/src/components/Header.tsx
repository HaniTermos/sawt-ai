import React from 'react';
import { Mic, Globe, DollarSign, Sparkles } from 'lucide-react';
import { ServerConfig } from '../types.js';

interface HeaderProps {
  config: ServerConfig | null;
  onResetSession: () => void;
}

export const Header: React.FC<HeaderProps> = ({ config, onResetSession }) => {
  return (
    <header className="header-bar">
      <div className="brand-section">
        <div className="brand-logo-badge">
          <Mic size={24} />
        </div>
        <div className="brand-titles">
          <h1>
            SAWT AI <Sparkles size={16} className="text-orange-400" />
          </h1>
          <p>Lebanese AI Restaurant Receptionist • Baytna Kitchen</p>
        </div>
      </div>

      <div className="header-badges">
        <span className="badge badge-demo">
          <span className="status-dot connected" style={{ width: 6, height: 6 }}></span>
          Demo Mode
        </span>

        <span className="badge badge-lang" title="Spoken Lebanese Arabic Vernacular">
          <Globe size={14} />
          اللهجة اللبنانية (Lebanese Arabic)
        </span>

        <span className="badge badge-currency" title="USD Currency Source of Truth">
          <DollarSign size={14} />
          Currency: USD
        </span>

        <button
          onClick={onResetSession}
          className="btn-secondary"
          title="Reset cart and session state"
          style={{ fontSize: '0.78rem', padding: '6px 12px' }}
        >
          New Call / Reset
        </button>
      </div>
    </header>
  );
};
