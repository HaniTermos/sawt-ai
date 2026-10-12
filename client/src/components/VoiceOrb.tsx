import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, Radio, AlertCircle } from 'lucide-react';
import { ConnectionState } from '../types.js';

interface VoiceOrbProps {
  connectionState: ConnectionState;
  isVoiceActive: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  errorMessage: string | null;
  openaiConfigured: boolean;
  vapiConfigured?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  connectionState,
  isVoiceActive,
  onStartCall,
  onEndCall,
  errorMessage,
  openaiConfigured,
  vapiConfigured,
}) => {
  const getOrbStateClass = () => {
    if (connectionState === 'speaking') return 'speaking';
    if (connectionState === 'listening') return 'listening';
    return '';
  };

  const getStatusLabel = () => {
    switch (connectionState) {
      case 'requesting-permission':
        return 'Requesting Microphone Access...';
      case 'connecting':
        return vapiConfigured ? 'Connecting to Vapi Voice...' : 'Connecting to OpenAI WebRTC...';
      case 'connected':
        return 'Connected • Ready';
      case 'listening':
        return 'Listening (Lebanese Arabic)...';
      case 'speaking':
        return 'Baytna AI Speaking...';
      case 'error':
        return 'Connection Error';
      default:
        return vapiConfigured
          ? 'Call Ready • Powered by Vapi.ai'
          : 'Call Ready • Click Start';
    }
  };

  const getDotClass = () => {
    switch (connectionState) {
      case 'connected':
        return 'connected';
      case 'listening':
        return 'listening';
      case 'speaking':
        return 'speaking';
      case 'error':
        return 'error';
      default:
        return '';
    }
  };

  return (
    <div className="orb-stage">
      {/* Animated Orb */}
      <div
        className="orb-container"
        onClick={isVoiceActive ? onEndCall : onStartCall}
        title={isVoiceActive ? 'Click to end call' : 'Click to start voice call'}
      >
        <div className={`orb-glow-outer ${isVoiceActive ? 'active' : ''}`} />
        <div className={`orb-sphere ${getOrbStateClass()}`}>
          {connectionState === 'speaking' ? (
            <Volume2 size={44} />
          ) : isVoiceActive ? (
            <Mic size={44} />
          ) : (
            <Radio size={44} />
          )}
        </div>
      </div>

      {/* Status Pill */}
      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <div className="status-indicator">
          <span className={`status-dot ${getDotClass()}`} />
          <span>{getStatusLabel()}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="call-controls">
        {!isVoiceActive ? (
          <button
            onClick={onStartCall}
            className="btn-primary"
            disabled={connectionState === 'requesting-permission' || connectionState === 'connecting'}
          >
            <PhoneCall size={18} />
            Start Conversation
          </button>
        ) : (
          <button onClick={onEndCall} className="btn-danger">
            <PhoneOff size={18} />
            End Call
          </button>
        )}
      </div>

      {/* Error or API Notice */}
      {errorMessage && (
        <div className="error-notice" style={{ marginTop: 16, width: '100%', maxWidth: 460 }}>
          <AlertCircle size={20} />
          <div>
            <strong>Audio / Connection Alert:</strong>
            <div style={{ fontSize: '0.8rem', marginTop: 2 }}>{errorMessage}</div>
          </div>
        </div>
      )}

      {!openaiConfigured && !vapiConfigured && (
        <div className="info-notice" style={{ marginTop: 14, width: '100%', maxWidth: 460 }}>
          <AlertCircle size={20} />
          <div>
            <strong>Interactive Demo Mode:</strong>
            <div style={{ fontSize: '0.8rem', marginTop: 2 }}>
              Voice provider key not configured in .env. You can test complete ordering, cart calculation, Lebanese Arabic dialogue, and confirmation using the text console below!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
