import { executeBackendTool } from './api.js';

export interface WebRTCEventCallbacks {
  onConnectionStateChange: (state: string) => void;
  onCustomerTranscript: (text: string, isFinal: boolean) => void;
  onAiTranscriptDelta: (delta: string) => void;
  onAiTranscriptDone: (text: string) => void;
  onToolExecuted: (toolName: string, result: any) => void;
  onError: (errorMsg: string) => void;
}

export class OpenAIRealtimeWebRTC {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sessionId: string;
  private callbacks: WebRTCEventCallbacks;
  private currentAiMessageAccumulator = '';

  constructor(sessionId: string, callbacks: WebRTCEventCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  public async connect(ephemeralKey: string, model = 'gpt-4o-realtime-preview-2024-12-17') {
    try {
      this.callbacks.onConnectionStateChange('requesting-permission');

      // 1. Request microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.callbacks.onConnectionStateChange('connecting');

      // 2. Setup audio element for remote audio stream
      if (!this.audioElement) {
        this.audioElement = document.createElement('audio');
        this.audioElement.autoplay = true;
      }

      // 3. Create RTCPeerConnection
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // Handle remote audio stream
      this.pc.ontrack = (event) => {
        if (this.audioElement && event.streams[0]) {
          this.audioElement.srcObject = event.streams[0];
        }
      };

      // Add user mic track to peer connection
      for (const track of this.localStream.getTracks()) {
        this.pc.addTrack(track, this.localStream);
      }

      // 4. Create data channel for OpenAI Realtime events
      this.dc = this.pc.createDataChannel('oai-events');
      this.setupDataChannel(this.dc);

      // 5. Create SDP offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 6. Connect to OpenAI Realtime WebRTC calls endpoint
      const sdpUrl = 'https://api.openai.com/v1/realtime/calls';
      const sdpResponse = await fetch(sdpUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`OpenAI WebRTC SDP exchange failed: ${sdpResponse.status} ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: answerSdp,
      };

      await this.pc.setRemoteDescription(answer);
      this.callbacks.onConnectionStateChange('connected');
    } catch (err: any) {
      console.error('WebRTC connection failed:', err);
      this.disconnect();
      this.callbacks.onError(err.message || 'Microphone or WebRTC connection failed');
      this.callbacks.onConnectionStateChange('error');
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => {
      console.log('[WebRTC] OpenAI Realtime data channel open');
      this.callbacks.onConnectionStateChange('listening');

      // Send initial trigger to greet customer in Lebanese Arabic
      this.sendEvent({
        type: 'response.create',
        response: {
          modalities: ['audio', 'text'],
          instructions: 'Gently greet the customer in warm Lebanese Arabic: "أهلا وسهلا! معك المساعد الافتراضي لمطعم بيتنا. شو بتحب تطلب اليوم؟"',
        },
      });
    };

    dc.onclose = () => {
      console.log('[WebRTC] Data channel closed');
      this.callbacks.onConnectionStateChange('disconnected');
    };

    dc.onerror = (err) => {
      console.error('[WebRTC] Data channel error:', err);
    };

    dc.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleRealtimeServerEvent(message);
      } catch (e) {
        console.error('Failed to parse realtime message:', e);
      }
    };
  }

  private async handleRealtimeServerEvent(event: any) {
    const type = event.type;

    switch (type) {
      // User started speaking (interruption event)
      case 'input_audio_buffer.speech_started': {
        this.callbacks.onConnectionStateChange('listening');
        break;
      }

      // Customer speech transcription completed via whisper
      case 'conversation.item.input_audio_transcription.completed': {
        if (event.transcript && event.transcript.trim()) {
          this.callbacks.onCustomerTranscript(event.transcript.trim(), true);
        }
        break;
      }

      // Assistant audio transcript streaming
      case 'response.audio_transcript.delta': {
        this.callbacks.onConnectionStateChange('speaking');
        this.currentAiMessageAccumulator += event.delta;
        this.callbacks.onAiTranscriptDelta(event.delta);
        break;
      }

      case 'response.audio_transcript.done': {
        const fullText = event.transcript || this.currentAiMessageAccumulator;
        this.callbacks.onAiTranscriptDone(fullText);
        this.currentAiMessageAccumulator = '';
        this.callbacks.onConnectionStateChange('listening');
        break;
      }

      // Function/Tool Call Invocation from Model
      case 'response.function_call_arguments.done': {
        const callId = event.call_id;
        const name = event.name;
        let args: any = {};
        try {
          args = JSON.parse(event.arguments || '{}');
        } catch {
          args = {};
        }

        // Always inject sessionId into tool call
        args.sessionId = this.sessionId;

        console.log(`[Tool Call from Model] ${name}:`, args);

        // Execute authoritative tool on backend
        try {
          const toolResult = await executeBackendTool(name, args);
          this.callbacks.onToolExecuted(name, toolResult);

          // Return result back to OpenAI Realtime model
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(toolResult),
            },
          });

          // Instruct model to continue conversational flow
          this.sendEvent({
            type: 'response.create',
          });
        } catch (toolError: any) {
          console.error(`Tool execution error (${name}):`, toolError);
          this.sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ error: toolError.message || 'Tool execution failed' }),
            },
          });
          this.sendEvent({
            type: 'response.create',
          });
        }
        break;
      }

      case 'error': {
        console.error('[OpenAI Realtime Error]', event.error);
        if (event.error?.message) {
          this.callbacks.onError(event.error.message);
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  }

  public sendUserTextMessage(text: string) {
    if (!this.dc || this.dc.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text,
          },
        ],
      },
    });

    this.sendEvent({
      type: 'response.create',
    });
  }

  private sendEvent(eventObj: any) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(eventObj));
    }
  }

  public disconnect() {
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
      this.dc = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
    }

    this.currentAiMessageAccumulator = '';
    this.callbacks.onConnectionStateChange('disconnected');
  }
}
