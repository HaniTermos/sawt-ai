export type FulfillmentType = 'pickup' | 'delivery';

export type OrderStatus = 'Draft' | 'Awaiting Confirmation' | 'Confirmed' | 'Cancelled';

export interface ModifierOption {
  id: string;
  name: string;
  nameArabic: string;
  priceCents: number; // integer cents
}

export interface MenuItem {
  id: string;
  name: string;
  nameArabic: string;
  category: 'Wraps' | 'Sides' | 'Beverages';
  description: string;
  descriptionArabic: string;
  priceCents: number; // integer cents (source of truth)
  availableModifiers?: ModifierOption[];
}

export interface CartItemModifier {
  id: string;
  name: string;
  nameArabic: string;
  priceCents: number;
}

export interface CartItem {
  id: string; // unique cart line id
  menuItemId: string;
  name: string;
  nameArabic: string;
  quantity: number;
  unitPriceCents: number; // base unit price
  modifiers: CartItemModifier[];
  lineTotalCents: number; // (unitPriceCents + sum(modifierCents)) * quantity
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
  confirmationVersion: string; // changes whenever cart/fulfillment/address is updated
  orderNumber?: string; // assigned only when confirmed
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

// Tool Input Types
export interface UpdateCartInput {
  sessionId: string;
  action: 'add' | 'update' | 'remove' | 'clear';
  menuItemId?: string;
  cartItemId?: string;
  quantity?: number;
  modifierIds?: string[];
  fulfillment?: FulfillmentType;
  customerAddress?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface CalculateOrderInput {
  sessionId: string;
  fulfillment?: FulfillmentType;
}

export interface PrepareConfirmationInput {
  sessionId: string;
  fulfillment?: FulfillmentType;
  customerAddress?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface ConfirmOrderInput {
  sessionId: string;
  confirmationVersion: string;
  explicitConfirmed: boolean;
}

export interface CancelOrderInput {
  sessionId: string;
  reason?: string;
}
