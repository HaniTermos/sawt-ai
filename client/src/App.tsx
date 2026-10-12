import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header.js';
import { VoiceOrb } from './components/VoiceOrb.js';
import { Transcript } from './components/Transcript.js';
import { TextChatBar } from './components/TextChatBar.js';
import { OrderSummaryPanel } from './components/OrderSummaryPanel.js';
import { RecentOrdersPanel } from './components/RecentOrdersPanel.js';
import { MenuReferenceCard } from './components/MenuReferenceCard.js';
import {
  ChatMessage,
  ConnectionState,
  ConfirmedOrderRecord,
  DraftOrder,
  MenuItem,
  ServerConfig,
  FulfillmentType,
} from './types.js';
import {
  fetchServerConfig,
  fetchMenu,
  fetchCart,
  fetchRecentOrders,
  createRealtimeSession,
  sendChatMessage,
  executeBackendTool,
} from './services/api.js';
import { OpenAIRealtimeWebRTC } from './services/webrtc.js';
import { VapiVoiceManager } from './services/vapi.js';
import { nanoid } from 'nanoid';

export const App: React.FC = () => {
  // Session Identification
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = sessionStorage.getItem('baytna_session_id');
    if (saved) return saved;
    const fresh = `sess_${nanoid(10)}`;
    sessionStorage.setItem('baytna_session_id', fresh);
    return fresh;
  });

  // Data State
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [draft, setDraft] = useState<DraftOrder | null>(null);
  const [recentOrders, setRecentOrders] = useState<ConfirmedOrderRecord[]>([]);

  // Conversation & WebRTC State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingAiText, setStreamingAiText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessingText, setIsProcessingText] = useState(false);

  const webrtcRef = useRef<OpenAIRealtimeWebRTC | null>(null);
  const vapiRef = useRef<VapiVoiceManager | null>(null);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      const [cfg, menuRes, cartRes, ordersRes] = await Promise.all([
        fetchServerConfig().catch(() => null),
        fetchMenu().catch(() => ({ restaurant: 'Baytna Kitchen', items: [] })),
        fetchCart(sessionId).catch(() => null),
        fetchRecentOrders().catch(() => []),
      ]);

      if (cfg) setConfig(cfg);
      if (menuRes) setMenuItems(menuRes.items);
      if (cartRes) setDraft(cartRes);
      if (ordersRes) setRecentOrders(ordersRes);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Refresh cart & orders
  const refreshCartAndOrders = useCallback(async () => {
    try {
      const [newCart, newOrders] = await Promise.all([
        fetchCart(sessionId),
        fetchRecentOrders(),
      ]);
      setDraft(newCart);
      setRecentOrders(newOrders);
    } catch (err) {
      console.error('Failed to refresh cart/orders:', err);
    }
  }, [sessionId]);

  // Synthesize speech optionally in text demo mode (browser fallback)
  const speakTextIfPossible = (text: string) => {
    if ('speechSynthesis' in window && connectionState === 'disconnected') {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-LB'; // Lebanese Arabic preference
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        // Speech synthesis is an optional bonus for text mode
      }
    }
  };

  // Start Live Voice Call (Vapi or OpenAI)
  const handleStartVoiceCall = async () => {
    setErrorMessage(null);

    // Prioritize Vapi when configured
    if (config?.vapiConfigured && config?.vapiPublicKey) {
      try {
        const vapi = new VapiVoiceManager(sessionId, {
          onConnectionStateChange: (state) => {
            setConnectionState(state as ConnectionState);
          },
          onCustomerTranscript: (text) => {
            setMessages((prev) => [
              ...prev,
              { id: nanoid(8), sender: 'customer', text, timestamp: Date.now() },
            ]);
          },
          onAiTranscriptDelta: (delta) => {
            setStreamingAiText((prev) => prev + delta);
          },
          onAiTranscriptDone: (fullText) => {
            setStreamingAiText('');
            setMessages((prev) => [
              ...prev,
              { id: nanoid(8), sender: 'ai', text: fullText, timestamp: Date.now() },
            ]);
          },
          onToolExecuted: (toolName, result) => {
            console.log('[Vapi Tool Executed]', toolName, result);
            refreshCartAndOrders();
            setMessages((prev) => [
              ...prev,
              {
                id: nanoid(8),
                sender: 'system',
                text: `Tool: ${toolName}`,
                toolEvent: toolName,
                timestamp: Date.now(),
              },
            ]);
          },
          onError: (err) => {
            setErrorMessage(err);
            setConnectionState('error');
          },
        });

        vapiRef.current = vapi;
        await vapi.connect(config.vapiPublicKey, config.vapiAssistantId);
        return;
      } catch (err: any) {
        console.error('Failed to start Vapi voice call:', err);
        setErrorMessage(err.message || 'Microphone access denied or connection failed.');
        setConnectionState('error');
        return;
      }
    }

    // Fallback to OpenAI WebRTC
    try {
      const sessionData = await createRealtimeSession();

      if (!sessionData.configured || sessionData.error === 'OPENAI_API_KEY_MISSING') {
        setErrorMessage(
          'Voice provider is not configured. Live voice requires VAPI_PUBLIC_KEY or OPENAI_API_KEY. You can test complete ordering using the text input below!'
        );
        return;
      }

      if (!sessionData.clientSecret?.value) {
        setErrorMessage('Failed to obtain OpenAI Realtime ephemeral key.');
        return;
      }

      const clientSecretKey = sessionData.clientSecret.value;

      // Initialize WebRTC Manager
      const webrtc = new OpenAIRealtimeWebRTC(sessionId, {
        onConnectionStateChange: (state) => {
          setConnectionState(state as ConnectionState);
        },
        onCustomerTranscript: (text) => {
          setMessages((prev) => [
            ...prev,
            { id: nanoid(8), sender: 'customer', text, timestamp: Date.now() },
          ]);
        },
        onAiTranscriptDelta: (delta) => {
          setStreamingAiText((prev) => prev + delta);
        },
        onAiTranscriptDone: (fullText) => {
          setStreamingAiText('');
          setMessages((prev) => [
            ...prev,
            { id: nanoid(8), sender: 'ai', text: fullText, timestamp: Date.now() },
          ]);
        },
        onToolExecuted: (toolName, result) => {
          console.log('[WebRTC Tool Executed]', toolName, result);
          refreshCartAndOrders();
          setMessages((prev) => [
            ...prev,
            {
              id: nanoid(8),
              sender: 'system',
              text: `Tool: ${toolName}`,
              toolEvent: toolName,
              timestamp: Date.now(),
            },
          ]);
        },
        onError: (err) => {
          setErrorMessage(err);
          setConnectionState('error');
        },
      });

      webrtcRef.current = webrtc;
      await webrtc.connect(clientSecretKey, sessionData.model);
    } catch (err: any) {
      console.error('Failed to start voice call:', err);
      setErrorMessage(err.message || 'Microphone access denied or connection failed.');
      setConnectionState('error');
    }
  };

  // End Live Voice Call
  const handleEndVoiceCall = async () => {
    // 1. Immediately reset UI state
    setConnectionState('disconnected');
    setStreamingAiText('');

    // 2. Disconnect Vapi session & audio
    if (vapiRef.current) {
      const vapi = vapiRef.current;
      vapiRef.current = null;
      try {
        await vapi.disconnect();
      } catch (err) {
        console.warn('Error disconnecting Vapi:', err);
      }
    }

    // 3. Disconnect OpenAI WebRTC if active
    if (webrtcRef.current) {
      const webrtc = webrtcRef.current;
      webrtcRef.current = null;
      try {
        webrtc.disconnect();
      } catch (err) {
        console.warn('Error disconnecting WebRTC:', err);
      }
    }

    // 4. Force pause all active audio elements on page
    try {
      document.querySelectorAll('audio').forEach((el) => {
        el.pause();
        el.srcObject = null;
      });
    } catch {}
  };

  // Handle Text Message (Same backend ordering engine)
  const handleSendTextMessage = async (text: string) => {
    if (!text.trim()) return;

    // 1. Add user message to transcript
    const userMsgId = nanoid(8);
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'customer', text, timestamp: Date.now() },
    ]);

    // If live Vapi voice session is active, forward text to Vapi
    if (vapiRef.current && (connectionState === 'listening' || connectionState === 'connected' || connectionState === 'speaking')) {
      try {
        vapiRef.current.sendUserTextMessage(text);
        return;
      } catch (err) {
        console.warn('Failed to send text to Vapi, falling back to server chat API:', err);
      }
    }

    // If live WebRTC voice session is active, forward text to data channel!
    if (webrtcRef.current && (connectionState === 'listening' || connectionState === 'connected')) {
      try {
        webrtcRef.current.sendUserTextMessage(text);
        return;
      } catch (err) {
        console.warn('Failed to send text to data channel, falling back to server chat API:', err);
      }
    }

    // Otherwise, execute through server ordering chat endpoint
    setIsProcessingText(true);
    try {
      const response = await sendChatMessage(sessionId, text);

      if (response.toolCalled) {
        setMessages((prev) => [
          ...prev,
          {
            id: nanoid(8),
            sender: 'system',
            text: `Tool executed: ${response.toolCalled}`,
            toolEvent: response.toolCalled,
            timestamp: Date.now(),
          },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(8),
          sender: 'ai',
          text: response.textResponse,
          timestamp: Date.now(),
        },
      ]);

      if (response.draftState) {
        setDraft(response.draftState);
      }
      refreshCartAndOrders();
      speakTextIfPossible(response.textResponse);
    } catch (err: any) {
      console.error('Text chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: nanoid(8),
          sender: 'system',
          text: `Error: ${err.message || 'Failed to process message'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessingText(false);
    }
  };

  // Quick Action: Add Item from Menu Card
  const handleQuickAddItem = async (menuItemId: string) => {
    try {
      const result = await executeBackendTool('update_cart', {
        sessionId,
        action: 'add',
        menuItemId,
        quantity: 1,
      });

      if (result.success && result.draft) {
        setDraft(result.draft);
        refreshCartAndOrders();
        setMessages((prev) => [
          ...prev,
          {
            id: nanoid(8),
            sender: 'system',
            text: `Added 1x ${menuItemId} to cart. Total: ${result.totalUsd}`,
            toolEvent: 'update_cart',
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to add item:', err);
    }
  };

  // Quick Action: Update Fulfillment (Pickup vs Delivery)
  const handleUpdateFulfillment = async (type: FulfillmentType, address?: string) => {
    try {
      const result = await executeBackendTool('update_cart', {
        sessionId,
        action: 'update',
        fulfillment: type,
        customerAddress: address,
      });

      if (result.draft) {
        setDraft(result.draft);
        refreshCartAndOrders();
      }
    } catch (err) {
      console.error('Failed to update fulfillment:', err);
    }
  };

  // Quick Action: Clear Cart
  const handleClearCart = async () => {
    try {
      const result = await executeBackendTool('update_cart', {
        sessionId,
        action: 'clear',
      });
      if (result.draft) {
        setDraft(result.draft);
        refreshCartAndOrders();
      }
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  // Reset Session
  const handleResetSession = () => {
    handleEndVoiceCall();
    const fresh = `sess_${nanoid(10)}`;
    sessionStorage.setItem('baytna_session_id', fresh);
    setSessionId(fresh);
    setMessages([]);
    setErrorMessage(null);
    setDraft(null);
    setTimeout(() => {
      loadInitialData();
    }, 50);
  };

  const isVoiceActive =
    connectionState === 'connected' ||
    connectionState === 'listening' ||
    connectionState === 'speaking' ||
    connectionState === 'connecting' ||
    connectionState === 'requesting-permission';

  return (
    <div className="app-container">
      {/* Header */}
      <Header config={config} onResetSession={handleResetSession} />

      {/* Main Two-Column Layout */}
      <main className="dashboard-grid">
        {/* LEFT SIDE: Voice Orb, Call Controls, Live Transcript, Text Bar */}
        <section className="glass-panel voice-hero-panel">
          <div className="ai-demo-label">
            ✦ AI VOICE DEMONSTRATION • BAYTNA KITCHEN (مطعم بيتنا)
          </div>

          {/* Large Animated Microphone/Orb Visual */}
          <VoiceOrb
            connectionState={connectionState}
            isVoiceActive={isVoiceActive}
            onStartCall={handleStartVoiceCall}
            onEndCall={handleEndVoiceCall}
            errorMessage={errorMessage}
            openaiConfigured={Boolean(config?.openaiConfigured)}
            vapiConfigured={Boolean(config?.vapiConfigured)}
          />

          {/* Live Transcript with separate customer and AI messages */}
          <Transcript messages={messages} streamingAiText={streamingAiText} />

          {/* Text input and Send button on same page (Same ordering backend) */}
          <TextChatBar
            onSendMessage={handleSendTextMessage}
            disabled={isProcessingText}
          />
        </section>

        {/* RIGHT SIDE: Interactive Order Summary & Recent Orders Panel */}
        <section className="right-column">
          <OrderSummaryPanel
            draft={draft}
            onUpdateFulfillment={handleUpdateFulfillment}
            onClearCart={handleClearCart}
          />

          {/* Menu Quick Reference & Demo Items */}
          <MenuReferenceCard
            items={menuItems}
            onQuickAddItem={handleQuickAddItem}
            disabled={draft?.status === 'Confirmed'}
          />

          {/* Compact Recent Orders Panel */}
          <RecentOrdersPanel
            orders={recentOrders}
            onRefresh={refreshCartAndOrders}
          />
        </section>
      </main>

      {/* Footer / Fictional Demonstration Notice */}
      <footer className="footer-disclaimer">
        Baytna Kitchen (مطعم بيتنا) is a fictional demonstration brand. In-memory demo store resets on server restart. Built with React, Node.js Express, TypeScript, and OpenAI Realtime WebRTC.
      </footer>
    </div>
  );
};
export default App;
