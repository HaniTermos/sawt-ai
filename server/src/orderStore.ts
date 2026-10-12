import { nanoid } from 'nanoid';
import {
  CartItem,
  ConfirmedOrderRecord,
  CustomerInfo,
  DraftOrder,
  FulfillmentType,
  MenuItem,
  OrderCalculation,
  OrderStatus,
} from './types.js';
import { BAYTNA_MENU, COMMON_MODIFIERS, STANDARD_DELIVERY_FEE_CENTS } from './menuData.js';

export function centsToUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatUsdDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Convert integer cents into natural Lebanese Arabic spoken description
export function centsToLebaneseSpoken(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainingCents = cents % 100;

  const dollarWords: Record<number, string> = {
    0: 'صفر دولار',
    1: 'دولار واحد',
    2: 'دولارين',
    3: 'تلاتة دولار',
    4: 'أربعة دولار',
    5: 'خمسة دولار',
    6: 'ستّة دولار',
    7: 'سبعة دولار',
    8: 'تمنية دولار',
    9: 'تسعة دولار',
    10: 'عشرة دولار',
    11: 'إحدعشر دولار',
    12: 'تنطعشر دولار',
    13: 'تلطعشر دولار',
    14: 'أربعطعشر دولار',
    15: 'خمسطعشر دولار',
    16: 'ستطعشر دولار',
    17: 'سبطعشر دولار',
    18: 'تمنطعشر دولار',
    19: 'تسعطعشر دولار',
    20: 'عشرين دولار',
    21: 'واحد وعشرين دولار',
    22: 'تنين وعشرين دولار',
    23: 'تلاتة وعشرين دولار',
    24: 'أربعة وعشرين دولار',
    25: 'خمسة وعشرين دولار',
    26: 'ستّة وعشرين دولار',
    27: 'سبعة وعشرين دولار',
    28: 'تمنية وعشرين دولار',
    29: 'تسعة وعشرين دولار',
    30: 'تلاتين دولار',
  };

  const dollarPhrase = dollarWords[dollars] || `${dollars} دولار`;

  if (remainingCents === 0) {
    return dollarPhrase;
  } else if (remainingCents === 50) {
    return `${dollarPhrase} ونص (${remainingCents} سنت)`;
  } else {
    return `${dollarPhrase} و ${remainingCents} سنت`;
  }
}

export class OrderStore {
  // In-memory tables (designed to be replaceable with PostgreSQL / MongoDB)
  private drafts: Map<string, DraftOrder> = new Map(); // key: sessionId
  private confirmedOrders: ConfirmedOrderRecord[] = [];
  private orderSequence = 1000;

  constructor() {
    // Note: in-memory demo store. Orders reset upon server restart.
  }

  public getOrCreateDraft(sessionId: string): DraftOrder {
    let draft = this.drafts.get(sessionId);
    if (!draft) {
      draft = {
        id: `draft_${nanoid(10)}`,
        sessionId,
        status: 'Draft',
        items: [],
        fulfillment: 'pickup',
        customer: {},
        calculation: this.calculateCart([], 'pickup'),
        confirmationVersion: nanoid(8),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.drafts.set(sessionId, draft);
    }
    return draft;
  }

  public getDraft(sessionId: string): DraftOrder | undefined {
    return this.drafts.get(sessionId);
  }

  public calculateCart(items: CartItem[], fulfillment: FulfillmentType): OrderCalculation {
    let subtotalCents = 0;
    let itemCount = 0;

    for (const item of items) {
      // Recalculate line total strictly using integer cents
      let unitCost = item.unitPriceCents;
      for (const mod of item.modifiers) {
        unitCost += mod.priceCents;
      }
      item.lineTotalCents = unitCost * item.quantity;
      subtotalCents += item.lineTotalCents;
      itemCount += item.quantity;
    }

    const deliveryFeeCents = fulfillment === 'delivery' && items.length > 0
      ? STANDARD_DELIVERY_FEE_CENTS
      : 0;

    const totalCents = subtotalCents + deliveryFeeCents;

    return {
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      subtotalUsd: centsToUsd(subtotalCents),
      deliveryFeeUsd: centsToUsd(deliveryFeeCents),
      totalUsd: centsToUsd(totalCents),
      itemCount,
    };
  }

  public updateCartItem(
    sessionId: string,
    action: 'add' | 'update' | 'remove' | 'clear',
    menuItemId?: string,
    cartItemId?: string,
    quantity?: number,
    modifierIds?: string[],
    fulfillment?: FulfillmentType,
    customerAddress?: string,
    customerName?: string,
    customerPhone?: string
  ): { draft: DraftOrder; error?: string } {
    const draft = this.getOrCreateDraft(sessionId);

    if (draft.status === 'Confirmed') {
      return { draft, error: 'Cannot modify an already confirmed order. Please start a new order.' };
    }

    if (action === 'clear') {
      draft.items = [];
    } else if (action === 'remove') {
      if (cartItemId) {
        draft.items = draft.items.filter((i) => i.id !== cartItemId);
      } else if (menuItemId) {
        draft.items = draft.items.filter((i) => i.menuItemId !== menuItemId);
      } else {
        return { draft, error: 'cartItemId or menuItemId required to remove item.' };
      }
    } else if (action === 'add') {
      if (!menuItemId) {
        return { draft, error: 'menuItemId is required to add an item.' };
      }

      const menuItem = BAYTNA_MENU.find((m) => m.id === menuItemId);
      if (!menuItem) {
        return { draft, error: `Menu item with id "${menuItemId}" not found in Baytna Kitchen menu.` };
      }

      const qty = Math.max(1, quantity || 1);
      const chosenModifiers: CartItem['modifiers'] = [];

      if (modifierIds && modifierIds.length > 0) {
        for (const modId of modifierIds) {
          const modOption = COMMON_MODIFIERS[modId];
          if (modOption) {
            chosenModifiers.push({
              id: modOption.id,
              name: modOption.name,
              nameArabic: modOption.nameArabic,
              priceCents: modOption.priceCents,
            });
          }
        }
      }

      // Check if item with same modifiers already exists in cart
      const existing = draft.items.find(
        (i) =>
          i.menuItemId === menuItem.id &&
          JSON.stringify(i.modifiers.map((m) => m.id).sort()) ===
            JSON.stringify(chosenModifiers.map((m) => m.id).sort())
      );

      if (existing) {
        existing.quantity += qty;
        let unitCost = existing.unitPriceCents;
        for (const m of existing.modifiers) unitCost += m.priceCents;
        existing.lineTotalCents = unitCost * existing.quantity;
      } else {
        let unitCost = menuItem.priceCents;
        for (const m of chosenModifiers) unitCost += m.priceCents;
        const lineTotalCents = unitCost * qty;

        draft.items.push({
          id: `item_${nanoid(8)}`,
          menuItemId: menuItem.id,
          name: menuItem.name,
          nameArabic: menuItem.nameArabic,
          quantity: qty,
          unitPriceCents: menuItem.priceCents,
          modifiers: chosenModifiers,
          lineTotalCents,
        });
      }
    } else if (action === 'update') {
      if (cartItemId || menuItemId) {
        const target = draft.items.find((i) => (cartItemId ? i.id === cartItemId : i.menuItemId === menuItemId));
        if (!target) {
          return { draft, error: 'Item not found in current cart.' };
        }

        if (quantity !== undefined) {
          if (quantity <= 0) {
            draft.items = draft.items.filter((i) => i.id !== target.id);
          } else {
            target.quantity = quantity;
          }
        }

        if (modifierIds) {
          const chosenModifiers: CartItem['modifiers'] = [];
          for (const modId of modifierIds) {
            const modOption = COMMON_MODIFIERS[modId];
            if (modOption) {
              chosenModifiers.push({
                id: modOption.id,
                name: modOption.name,
                nameArabic: modOption.nameArabic,
                priceCents: modOption.priceCents,
              });
            }
          }
          target.modifiers = chosenModifiers;
        }

        let unitCost = target.unitPriceCents;
        for (const m of target.modifiers) unitCost += m.priceCents;
        target.lineTotalCents = unitCost * target.quantity;
      }
    }

    if (fulfillment) {
      draft.fulfillment = fulfillment;
    }
    if (customerAddress !== undefined) {
      draft.customer.address = customerAddress;
    }
    if (customerName !== undefined) {
      draft.customer.name = customerName;
    }
    if (customerPhone !== undefined) {
      draft.customer.phone = customerPhone;
    }

    // Recalculate everything
    draft.calculation = this.calculateCart(draft.items, draft.fulfillment);
    draft.confirmationVersion = nanoid(8); // Invalidates any prior confirmation
    draft.updatedAt = Date.now();
    draft.status = draft.items.length > 0 ? 'Draft' : 'Draft';

    return { draft };
  }

  public prepareConfirmation(
    sessionId: string,
    fulfillment?: FulfillmentType,
    customerAddress?: string,
    customerName?: string,
    customerPhone?: string
  ): {
    draft: DraftOrder;
    confirmationVersion: string;
    summaryArabic: string;
    summaryEnglish: string;
    totalSpokenArabic: string;
    error?: string;
  } {
    const draft = this.getOrCreateDraft(sessionId);

    if (draft.status === 'Confirmed') {
      return {
        draft,
        confirmationVersion: draft.confirmationVersion,
        summaryArabic: draft.summaryArabic || '',
        summaryEnglish: draft.summaryEnglish || '',
        totalSpokenArabic: '',
        error: 'Order is already confirmed.',
      };
    }

    if (draft.items.length === 0) {
      return {
        draft,
        confirmationVersion: draft.confirmationVersion,
        summaryArabic: '',
        summaryEnglish: '',
        totalSpokenArabic: '',
        error: 'Cart is empty. Please add items before confirming.',
      };
    }

    if (fulfillment) {
      draft.fulfillment = fulfillment;
    }
    if (customerAddress !== undefined) {
      draft.customer.address = customerAddress;
    }
    if (customerName !== undefined) {
      draft.customer.name = customerName;
    }
    if (customerPhone !== undefined) {
      draft.customer.phone = customerPhone;
    }

    if (draft.fulfillment === 'delivery' && (!draft.customer.address || draft.customer.address.trim().length === 0)) {
      return {
        draft,
        confirmationVersion: draft.confirmationVersion,
        summaryArabic: '',
        summaryEnglish: '',
        totalSpokenArabic: '',
        error: 'Delivery orders require a valid delivery address before confirmation.',
      };
    }

    // Refresh calculations
    draft.calculation = this.calculateCart(draft.items, draft.fulfillment);
    draft.confirmationVersion = nanoid(8);
    draft.status = 'Awaiting Confirmation';
    draft.updatedAt = Date.now();

    // Build canonical summary
    const itemSummariesAr: string[] = [];
    const itemSummariesEn: string[] = [];

    for (const item of draft.items) {
      const unitSpoken = centsToLebaneseSpoken(item.unitPriceCents);
      const modText = item.modifiers.length > 0
        ? ` مع (${item.modifiers.map((m) => m.nameArabic).join('، ')})`
        : '';
      const modTextEn = item.modifiers.length > 0
        ? ` with (${item.modifiers.map((m) => m.name).join(', ')})`
        : '';

      itemSummariesAr.push(
        `${item.quantity} ${item.nameArabic}${modText} بـ ${centsToLebaneseSpoken(item.lineTotalCents)}`
      );
      itemSummariesEn.push(
        `${item.quantity}x ${item.name}${modTextEn} ($${centsToUsd(item.lineTotalCents)})`
      );
    }

    const totalSpokenArabic = centsToLebaneseSpoken(draft.calculation.totalCents);
    const fulfillmentTextAr = draft.fulfillment === 'delivery'
      ? `توصيل (Delivery) للعنوان: ${draft.customer.address}`
      : 'استلام من المطعم (Pickup)';
    const fulfillmentTextEn = draft.fulfillment === 'delivery'
      ? `Delivery to: ${draft.customer.address}`
      : 'Pickup';

    const summaryArabic = `طلبك هو: ${itemSummariesAr.join('، ')}. طريقة الاستلام: ${fulfillmentTextAr}. المجموع الكامل: ${totalSpokenArabic} (${draft.calculation.totalUsd} دولار).`;
    const summaryEnglish = `Order: ${itemSummariesEn.join(', ')}. Fulfillment: ${fulfillmentTextEn}. Total: $${draft.calculation.totalUsd}.`;

    draft.summaryArabic = summaryArabic;
    draft.summaryEnglish = summaryEnglish;

    return {
      draft,
      confirmationVersion: draft.confirmationVersion,
      summaryArabic,
      summaryEnglish,
      totalSpokenArabic,
    };
  }

  public confirmOrder(
    sessionId: string,
    confirmationVersion: string,
    explicitConfirmed: boolean
  ): { confirmedOrder?: ConfirmedOrderRecord; draft: DraftOrder; error?: string } {
    const draft = this.getOrCreateDraft(sessionId);

    // Idempotency check: if draft was already confirmed with this version
    if (draft.status === 'Confirmed' && draft.orderNumber) {
      const existing = this.confirmedOrders.find((o) => o.orderNumber === draft.orderNumber);
      if (existing) {
        return { confirmedOrder: existing, draft };
      }
    }

    if (!explicitConfirmed) {
      return {
        draft,
        error: 'Order requires explicit customer confirmation. Cannot finalize while undecided.',
      };
    }

    if (draft.items.length === 0) {
      return { draft, error: 'Cannot confirm an empty cart.' };
    }

    if (draft.confirmationVersion !== confirmationVersion) {
      return {
        draft,
        error: 'Stale confirmation version. The order items or delivery info were modified. Please re-confirm current details.',
      };
    }

    if (draft.status !== 'Awaiting Confirmation') {
      return {
        draft,
        error: 'Order must be prepared and read back for confirmation before finalizing.',
      };
    }

    if (draft.fulfillment === 'delivery' && (!draft.customer.address || draft.customer.address.trim().length === 0)) {
      return {
        draft,
        error: 'Delivery orders must have a valid delivery address before confirmation.',
      };
    }

    // Authoritative server-side recalculation
    const calculation = this.calculateCart(draft.items, draft.fulfillment);
    draft.calculation = calculation;

    this.orderSequence += 1;
    const orderNumber = `BYT-${this.orderSequence}`;
    draft.orderNumber = orderNumber;
    draft.status = 'Confirmed';
    draft.confirmedAt = Date.now();
    draft.updatedAt = Date.now();

    const confirmedRecord: ConfirmedOrderRecord = {
      orderNumber,
      draftId: draft.id,
      sessionId: draft.sessionId,
      items: JSON.parse(JSON.stringify(draft.items)),
      fulfillment: draft.fulfillment,
      customer: JSON.parse(JSON.stringify(draft.customer)),
      calculation: JSON.parse(JSON.stringify(draft.calculation)),
      status: 'Confirmed',
      confirmedAt: draft.confirmedAt,
      summaryArabic: draft.summaryArabic || '',
      summaryEnglish: draft.summaryEnglish || '',
    };

    this.confirmedOrders.unshift(confirmedRecord);

    return { confirmedOrder: confirmedRecord, draft };
  }

  public cancelOrder(sessionId: string, reason?: string): { draft: DraftOrder; error?: string } {
    const draft = this.getOrCreateDraft(sessionId);

    if (draft.status === 'Confirmed') {
      return {
        draft,
        error: 'Cannot cancel an already confirmed order directly. Please contact restaurant staff.',
      };
    }

    draft.status = 'Cancelled';
    draft.items = [];
    draft.calculation = this.calculateCart([], draft.fulfillment);
    draft.confirmationVersion = nanoid(8);
    draft.updatedAt = Date.now();

    return { draft };
  }

  public getRecentOrders(limit = 10): ConfirmedOrderRecord[] {
    return this.confirmedOrders.slice(0, limit);
  }

  public resetSession(sessionId: string): DraftOrder {
    this.drafts.delete(sessionId);
    return this.getOrCreateDraft(sessionId);
  }
}

export const orderStore = new OrderStore();
