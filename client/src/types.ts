export type FulfillmentType = 'pickup' | 'delivery';

export type OrderStatus = 'Draft' | 'Awaiting Confirmation' | 'Confirmed' | 'Cancelled';

export interface ModifierOption {
  id: string;
  name: string;
  nameArabic: string;
  priceCents: number;
}

export interface MenuItem {
  id: string;
  name: string;
  nameArabic: string;
  category: 'Wraps' | 'Sides' | 'Beverages';
  description: string;
  descriptionArabic: string;
  priceCents: number;
  availableModifiers?: ModifierOption[];
}

export interface CartItemModifier {
  id: string;
  name: string;
  nameArabic: string;
  priceCents: number;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  nameArabic: string;
  quantity: number;
  unitPriceCents: number;
  modifiers: CartItemModifier[];
  lineTotalCents: number;
}

export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface OrderCalculation {
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  subtotalUsd: string;
  deliveryFeeUsd: string;
  totalUsd: string;
  itemCount: number;
}

export interface DraftOrder {
  id: string;
  sessionId: string;
  status: OrderStatus;
  items: CartItem[];
  fulfillment: FulfillmentType;
  customer: CustomerInfo;
  calculation: OrderCalculation;
  confirmationVersion: string;
  orderNumber?: string;
  createdAt: number;
  updatedAt: number;
  confirmedAt?: number;
  summaryArabic?: string;
  summaryEnglish?: string;
}

export interface ConfirmedOrderRecord {
  orderNumber: string;
  draftId: string;
  sessionId: string;
  items: CartItem[];
  fulfillment: FulfillmentType;
  customer: CustomerInfo;
  calculation: OrderCalculation;
  status: 'Confirmed';
  confirmedAt: number;
  summaryArabic: string;
  summaryEnglish: string;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'ai' | 'system';
  text: string;
  timestamp: number;
  toolEvent?: string;
  isStreaming?: boolean;
}

export type ConnectionState =
  | 'disconnected'
  | 'requesting-permission'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'error';

export interface ServerConfig {
  openaiConfigured: boolean;
  realtimeVoice: string;
  restaurant: string;
  currency: string;
  demoNotice: string;
  vapiConfigured?: boolean;
  vapiPublicKey?: string;
  vapiAssistantId?: string;
}
