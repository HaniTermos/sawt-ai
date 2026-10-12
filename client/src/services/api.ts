import { ConfirmedOrderRecord, DraftOrder, MenuItem, ServerConfig } from '../types.js';

const API_BASE = '/api';

async function parseResponse<T>(res: Response, endpointDescription: string): Promise<T> {
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Backend returned non-JSON response for ${endpointDescription} (Status ${res.status}). Verify backend is running on port 3001.`
    );
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export async function fetchServerConfig(): Promise<ServerConfig> {
  const res = await fetch(`${API_BASE}/config`);
  return parseResponse<ServerConfig>(res, 'fetchServerConfig');
}

export async function fetchMenu(): Promise<{ restaurant: string; items: MenuItem[] }> {
  const res = await fetch(`${API_BASE}/menu`);
  return parseResponse<{ restaurant: string; items: MenuItem[] }>(res, 'fetchMenu');
}

export async function fetchCart(sessionId: string): Promise<DraftOrder> {
  const res = await fetch(`${API_BASE}/cart/${sessionId}`);
  const data = await parseResponse<{ draft: DraftOrder }>(res, 'fetchCart');
  return data.draft;
}

export async function fetchRecentOrders(): Promise<ConfirmedOrderRecord[]> {
  const res = await fetch(`${API_BASE}/orders`);
  const data = await parseResponse<{ orders?: ConfirmedOrderRecord[] }>(res, 'fetchRecentOrders');
  return data.orders || [];
}

export async function createRealtimeSession(): Promise<{
  configured: boolean;
  clientSecret?: { value: string; expires_at?: number };
  sessionId?: string;
  model?: string;
  voice?: string;
  error?: string;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseResponse(res, 'createRealtimeSession');
}

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<{ textResponse: string; toolCalled?: string; draftState: DraftOrder }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
  return parseResponse(res, 'sendChatMessage');
}

export async function executeBackendTool(toolName: string, args: Record<string, any>): Promise<any> {
  const res = await fetch(`${API_BASE}/tools/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return parseResponse(res, `executeBackendTool(${toolName})`);
}
