import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { BAYTNA_MENU } from './menuData.js';
import { orderStore } from './orderStore.js';
import { executeTool, REALTIME_TOOLS_DEFINITIONS } from './tools.js';
import { LEBANESE_SYSTEM_PROMPT, processCustomerMessage } from './lebaneseAgent.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'alloy';
const VAPI_PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY?.trim() || '';
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID?.trim() || '';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limiting / throttle map
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  const ip = req.ip || 'anonymous';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return next();
  }
  entry.count++;
  if (entry.count > 200) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  next();
});

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    demoStore: 'in-memory (resets on restart)',
  });
});

app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    openaiConfigured: Boolean(OPENAI_API_KEY && OPENAI_API_KEY.length > 5),
    vapiConfigured: Boolean(VAPI_PUBLIC_KEY && VAPI_PUBLIC_KEY.length > 5),
    vapiPublicKey: VAPI_PUBLIC_KEY,
    vapiAssistantId: VAPI_ASSISTANT_ID,
    realtimeVoice: REALTIME_VOICE,
    restaurant: 'Baytna Kitchen (مطعم بيتنا)',
    currency: 'USD',
    demoNotice: 'Fictional restaurant demo. In-memory storage resets on server restart.',
  });
});

// Vapi Webhook for server-side function / tool execution
app.post('/api/vapi/webhook', async (req: Request, res: Response) => {
  const { message } = req.body || {};
  if (!message) {
    return res.status(200).json({ status: 'ok' });
  }

  try {
    if (message.type === 'tool-calls' && Array.isArray(message.toolCalls)) {
      const results = [];
      for (const call of message.toolCalls) {
        const name = call.function?.name;
        const args =
          typeof call.function?.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : call.function?.arguments || {};

        const toolResult = await executeTool(name, args);
        results.push({
          toolCallId: call.id,
          result: toolResult,
        });
      }
      return res.json({ results });
    }

    if (message.type === 'function-call') {
      const name = message.functionCall?.name;
      const args = message.functionCall?.parameters || {};
      const result = await executeTool(name, args);
      return res.json({ result });
    }

    return res.status(200).json({ status: 'received' });
  } catch (err: any) {
    console.error('Vapi webhook error:', err);
    return res.status(500).json({ error: err.message || 'Webhook processing failed' });
  }
});

app.get('/api/menu', (req: Request, res: Response) => {
  res.json({
    restaurant: 'Baytna Kitchen (مطعم بيتنا)',
    items: BAYTNA_MENU,
  });
});

app.get('/api/cart/:sessionId', (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId);
  const draft = orderStore.getOrCreateDraft(sessionId);
  res.json({ draft });
});

app.get('/api/orders', (req: Request, res: Response) => {
  const orders = orderStore.getRecentOrders(20);
  res.json({ orders });
});

// Execute backend tools directly from voice data channel or client
app.post('/api/tools/:name', async (req: Request, res: Response) => {
  const name = String(req.params.name);
  const args = req.body || {};

  try {
    const result = await executeTool(name, args);
    return res.json(result);
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    return res.status(400).json({
      success: false,
      error: error.message || 'Tool execution failed',
    });
  }
});

// Interactive text-based ordering endpoint (same backend as voice)
app.post('/api/chat', async (req: Request, res: Response) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    const response = await processCustomerMessage(sessionId, message);
    return res.json(response);
  } catch (error: any) {
    console.error('Error processing customer message:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

// Session creation for OpenAI Realtime WebRTC
app.post('/api/session', async (req: Request, res: Response) => {
  if (!OPENAI_API_KEY) {
    return res.status(200).json({
      configured: false,
      error: 'OPENAI_API_KEY_MISSING',
      message:
        'OpenAI API Key is not set in .env. Live WebRTC voice requires an API key, but you can test all features using the interactive Lebanese text chat mode and audio simulation on this page.',
    });
  }

  try {
    const realtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini';
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: realtimeModel,
          instructions: LEBANESE_SYSTEM_PROMPT,
          tools: REALTIME_TOOLS_DEFINITIONS,
          tool_choice: 'auto',
          audio: {
            output: {
              voice: REALTIME_VOICE,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI Realtime session error:', response.status, errText);
      return res.status(response.status).json({
        configured: true,
        error: 'OPENAI_SESSION_FAILED',
        details: errText,
      });
    }

    const data = (await response.json()) as any;
    const clientSecretValue = data.value || data.client_secret?.value;
    return res.json({
      configured: true,
      clientSecret: { value: clientSecretValue },
      sessionId: data.session?.id || data.id,
      model: realtimeModel,
      voice: REALTIME_VOICE,
    });
  } catch (err: any) {
    console.error('Failed to create Realtime session:', err);
    return res.status(500).json({
      configured: true,
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// Serve frontend build in production
import fs from 'fs';

const candidatePaths = [
  path.resolve(__dirname, '../../dist/client'),
  path.resolve(__dirname, '../client'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'dist/client'),
  path.resolve(process.cwd(), 'client/dist'),
];

let clientDistPath = candidatePaths[0];
for (const p of candidatePaths) {
  if (fs.existsSync(path.join(p, 'index.html'))) {
    clientDistPath = p;
    break;
  }
}

app.use(express.static(clientDistPath));

app.get('*', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send('Baytna Kitchen API Server is running. Client build pending.');
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Baytna AI Receptionist] Server running on http://localhost:${PORT}`);
    console.log(`[OpenAI Status] ${OPENAI_API_KEY ? 'API Key Configured' : 'No API Key - Running in local text/demo mode'}`);
  });
}

export default app;
