import Vapi from '@vapi-ai/web';
import { executeBackendTool } from './api.js';

export interface VapiEventCallbacks {
  onConnectionStateChange: (state: string) => void;
  onCustomerTranscript: (text: string, isFinal: boolean) => void;
  onAiTranscriptDelta: (delta: string) => void;
  onAiTranscriptDone: (text: string) => void;
  onToolExecuted: (toolName: string, result: any) => void;
  onError: (errorMsg: string) => void;
}

export class VapiVoiceManager {
  private vapi: any = null;
  private sessionId: string;
  private callbacks: VapiEventCallbacks;
  private isAborted = false;

  constructor(sessionId: string, callbacks: VapiEventCallbacks) {
    this.sessionId = sessionId;
    this.callbacks = callbacks;
  }

  public async connect(publicKey: string, assistantId?: string) {
    this.isAborted = false;
    try {
      this.callbacks.onConnectionStateChange('requesting-permission');
      const vapiInstance = new Vapi(publicKey);
      this.vapi = vapiInstance;

      vapiInstance.on('call-start', () => {
        if (!this.isAborted) {
          this.callbacks.onConnectionStateChange('listening');
        }
      });

      vapiInstance.on('speech-start', () => {
        if (!this.isAborted) {
          this.callbacks.onConnectionStateChange('speaking');
        }
      });

      vapiInstance.on('speech-end', () => {
        if (!this.isAborted) {
          this.callbacks.onConnectionStateChange('listening');
        }
      });

      vapiInstance.on('message', async (message: any) => {
        if (this.isAborted) return;

        if (message.type === 'transcript') {
          if (message.role === 'user') {
            this.callbacks.onCustomerTranscript(message.transcript, true);
          } else if (message.role === 'assistant') {
            this.callbacks.onAiTranscriptDone(message.transcript);
          }
        } else if (message.type === 'tool-calls' && Array.isArray(message.toolCalls)) {
          for (const call of message.toolCalls) {
            const name = call.function?.name;
            const args =
              typeof call.function?.arguments === 'string'
                ? JSON.parse(call.function.arguments || '{}')
                : call.function?.arguments || {};
            args.sessionId = this.sessionId;

            try {
              const toolResult = await executeBackendTool(name, args);
              this.callbacks.onToolExecuted(name, toolResult);
              vapiInstance.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  tool_call_id: call.id,
                  content: JSON.stringify(toolResult),
                },
              });
            } catch (err: any) {
              console.error(`Client tool execution error (${name}):`, err);
            }
          }
        }
      });

      vapiInstance.on('error', (err: any) => {
        console.error('Vapi error:', err);
        if (!this.isAborted) {
          const msg = err.message || (typeof err === 'string' ? err : 'Vapi voice connection error');
          this.callbacks.onError(msg);
          this.callbacks.onConnectionStateChange('error');
        }
      });

      vapiInstance.on('call-end', () => {
        this.callbacks.onConnectionStateChange('disconnected');
      });

      if (this.isAborted) {
        await this.disconnect();
        return;
      }

      this.callbacks.onConnectionStateChange('connecting');

      if (assistantId && assistantId.trim()) {
        await vapiInstance.start(assistantId.trim());
      } else {
        await vapiInstance.start({
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'أنت مساعد الاستقبال الافتراضي لمطعم بيتنا في بيروت. تحدث دائما باللهجة اللبنانية الودية.',
              },
            ],
          },
          firstMessage: 'أهلا وسهلا فيك بمطعم بيتنا! شو بتحب تطلب اليوم؟',
        });
      }

      // If user clicked end while start was awaiting
      if (this.isAborted) {
        await this.disconnect();
      }
    } catch (err: any) {
      if (!this.isAborted) {
        console.error('Failed to start Vapi voice call:', err);
        this.callbacks.onError(err.message || 'Failed to start Vapi voice call');
        this.callbacks.onConnectionStateChange('error');
      }
    }
  }

  public sendUserTextMessage(text: string) {
    if (this.vapi && !this.isAborted) {
      this.vapi.send({
        type: 'add-message',
        message: {
          role: 'user',
          content: text,
        },
      });
    }
  }

  public async disconnect() {
    this.isAborted = true;

    // 1. Immediately mute and clean up all audio elements in DOM
    try {
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((el) => {
        try {
          el.pause();
          el.srcObject = null;
          el.remove();
        } catch {}
      });
    } catch {}

    // 2. Remove Vapi event listeners & stop Vapi call
    if (this.vapi) {
      const instance = this.vapi;
      this.vapi = null;
      try {
        instance.removeAllListeners?.();
      } catch {}
      try {
        await instance.stop();
      } catch (e) {
        console.warn('Vapi stop error:', e);
      }
    }

    // 3. Guarantee connection state updates to disconnected
    this.callbacks.onConnectionStateChange('disconnected');
  }
}
