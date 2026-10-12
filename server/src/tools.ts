import { BAYTNA_MENU, COMMON_MODIFIERS } from './menuData.js';
import { orderStore, centsToUsd, centsToLebaneseSpoken } from './orderStore.js';
import {
  CalculateOrderInput,
  CancelOrderInput,
  ConfirmOrderInput,
  PrepareConfirmationInput,
  UpdateCartInput,
} from './types.js';

// OpenAI tool definitions format (compatible with Realtime API session tools)
export const REALTIME_TOOLS_DEFINITIONS = [
  {
    type: 'function',
    name: 'get_menu',
    description: 'Retrieve the official Baytna Kitchen menu with item IDs, names in Lebanese Arabic and English, and trusted USD prices.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['All', 'Wraps', 'Sides', 'Beverages'],
          description: 'Optional filter by category.',
        },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'update_cart',
    description: 'Add, update, or remove items in the customer cart, change quantities, select extras/modifiers, or set fulfillment method (pickup or delivery) and address.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Unique session identifier for the caller.',
        },
        action: {
          type: 'string',
          enum: ['add', 'update', 'remove', 'clear'],
          description: 'Action to perform on the cart.',
        },
        menuItemId: {
          type: 'string',
          description: 'Menu item ID (e.g., chicken_shawarma, beef_shawarma, falafel_wrap, hummus, french_fries, garlic_sauce, soft_drink, fresh_lemonade).',
        },
        cartItemId: {
          type: 'string',
          description: 'Optional line item ID when modifying or removing a specific line.',
        },
        quantity: {
          type: 'integer',
          description: 'Quantity of items (positive integer).',
        },
        modifierIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of extras/modifiers (e.g., extra_garlic, extra_pickles, spicy, extra_tahini, coke, diet_coke, sprite).',
        },
        fulfillment: {
          type: 'string',
          enum: ['pickup', 'delivery'],
          description: 'Whether the customer wants pickup or delivery.',
        },
        customerAddress: {
          type: 'string',
          description: 'Delivery address (required if delivery).',
        },
        customerName: {
          type: 'string',
          description: 'Customer name if provided.',
        },
        customerPhone: {
          type: 'string',
          description: 'Customer phone number if provided.',
        },
      },
      required: ['sessionId', 'action'],
    },
  },
  {
    type: 'function',
    name: 'calculate_order',
    description: 'Return current itemized subtotal, delivery fee, and exact total in USD. Authoritative calculations performed in integer cents on the backend.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Unique session identifier.',
        },
        fulfillment: {
          type: 'string',
          enum: ['pickup', 'delivery'],
          description: 'Optional fulfillment type to preview delivery fee.',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    type: 'function',
    name: 'prepare_confirmation',
    description: 'Generate a canonical order summary and unique confirmation version. Returns the exact items and total in USD and Lebanese spoken phrasing that the agent MUST read back to the customer before asking for confirmation.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Unique session identifier.',
        },
        fulfillment: {
          type: 'string',
          enum: ['pickup', 'delivery'],
          description: 'Fulfillment type: pickup or delivery.',
        },
        customerAddress: {
          type: 'string',
          description: 'Customer delivery address (mandatory for delivery).',
        },
        customerName: {
          type: 'string',
          description: 'Customer name.',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    type: 'function',
    name: 'confirm_order',
    description: 'Finalize and save the customer order into the restaurant system. Requires draft order confirmationVersion from prepare_confirmation and explicit customer confirmation. Saves order only once.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Unique session identifier.',
        },
        confirmationVersion: {
          type: 'string',
          description: 'The exact confirmationVersion returned by prepare_confirmation.',
        },
        explicitConfirmed: {
          type: 'boolean',
          description: 'Set to true ONLY if customer explicitly said yes / أكيد / ثبّت الطلب to the final question.',
        },
      },
      required: ['sessionId', 'confirmationVersion', 'explicitConfirmed'],
    },
  },
  {
    type: 'function',
    name: 'cancel_order',
    description: 'Cancel an uncommitted draft order or clear the cart if customer cancels or changes mind.',
    parameters: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Unique session identifier.',
        },
        reason: {
          type: 'string',
          description: 'Reason for cancellation.',
        },
      },
      required: ['sessionId'],
    },
  },
];

// Backend tool execution implementations
export async function executeTool(name: string, args: Record<string, any>): Promise<any> {
  switch (name) {
    case 'get_menu': {
      const category = args.category;
      let items = BAYTNA_MENU;
      if (category && category !== 'All') {
        items = BAYTNA_MENU.filter((i) => i.category === category);
      }
      return {
        restaurant: 'Baytna Kitchen (مطعم بيتنا)',
        note: 'Fictional demonstration data. Prices are exact source of truth in USD.',
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          nameArabic: item.nameArabic,
          category: item.category,
          priceUsd: `$${centsToUsd(item.priceCents)}`,
          priceCents: item.priceCents,
          priceSpokenArabic: centsToLebaneseSpoken(item.priceCents),
          availableModifiers: item.availableModifiers?.map((m) => ({
            id: m.id,
            name: m.name,
            nameArabic: m.nameArabic,
            priceUsd: `$${centsToUsd(m.priceCents)}`,
          })),
        })),
      };
    }

    case 'update_cart': {
      const input = args as UpdateCartInput;
      if (!input.sessionId) {
        return { success: false, error: 'sessionId is required' };
      }
      const result = orderStore.updateCartItem(
        input.sessionId,
        input.action,
        input.menuItemId,
        input.cartItemId,
        input.quantity,
        input.modifierIds,
        input.fulfillment,
        input.customerAddress,
        input.customerName,
        input.customerPhone
      );

      if (result.error) {
        return { success: false, error: result.error, draft: result.draft };
      }

      return {
        success: true,
        action: input.action,
        cartItemCount: result.draft.calculation.itemCount,
        subtotalUsd: `$${result.draft.calculation.subtotalUsd}`,
        deliveryFeeUsd: `$${result.draft.calculation.deliveryFeeUsd}`,
        totalUsd: `$${result.draft.calculation.totalUsd}`,
        totalSpokenArabic: centsToLebaneseSpoken(result.draft.calculation.totalCents),
        items: result.draft.items.map((i) => ({
          id: i.id,
          name: i.name,
          nameArabic: i.nameArabic,
          quantity: i.quantity,
          unitPriceUsd: `$${centsToUsd(i.unitPriceCents)}`,
          lineTotalUsd: `$${centsToUsd(i.lineTotalCents)}`,
          modifiers: i.modifiers.map((m) => m.nameArabic),
        })),
        fulfillment: result.draft.fulfillment,
        customerAddress: result.draft.customer.address,
        draft: result.draft,
      };
    }

    case 'calculate_order': {
      const input = args as CalculateOrderInput;
      if (!input.sessionId) {
        return { success: false, error: 'sessionId is required' };
      }
      const draft = orderStore.getOrCreateDraft(input.sessionId);
      if (input.fulfillment) {
        draft.fulfillment = input.fulfillment;
      }
      const calc = orderStore.calculateCart(draft.items, draft.fulfillment);
      return {
        success: true,
        itemCount: calc.itemCount,
        subtotalUsd: `$${calc.subtotalUsd}`,
        deliveryFeeUsd: `$${calc.deliveryFeeUsd}`,
        totalUsd: `$${calc.totalUsd}`,
        totalSpokenArabic: centsToLebaneseSpoken(calc.totalCents),
        items: draft.items.map((i) => ({
          nameArabic: i.nameArabic,
          quantity: i.quantity,
          lineTotalUsd: `$${centsToUsd(i.lineTotalCents)}`,
        })),
        fulfillment: draft.fulfillment,
      };
    }

    case 'prepare_confirmation': {
      const input = args as PrepareConfirmationInput;
      if (!input.sessionId) {
        return { success: false, error: 'sessionId is required' };
      }
      const result = orderStore.prepareConfirmation(
        input.sessionId,
        input.fulfillment,
        input.customerAddress,
        input.customerName,
        input.customerPhone
      );

      if (result.error) {
        return { success: false, error: result.error, draft: result.draft };
      }

      return {
        success: true,
        confirmationVersion: result.confirmationVersion,
        summaryArabic: result.summaryArabic,
        summaryEnglish: result.summaryEnglish,
        totalSpokenArabic: result.totalSpokenArabic,
        totalUsd: `$${result.draft.calculation.totalUsd}`,
        fulfillment: result.draft.fulfillment,
        status: result.draft.status,
        promptForAgent: `Read the following summary to the customer in natural Lebanese Arabic and ask for confirmation: "${result.summaryArabic} منثبّت الطلب؟"`,
      };
    }

    case 'confirm_order': {
      const input = args as ConfirmOrderInput;
      if (!input.sessionId) {
        return { success: false, error: 'sessionId is required' };
      }
      const result = orderStore.confirmOrder(
        input.sessionId,
        input.confirmationVersion,
        Boolean(input.explicitConfirmed)
      );

      if (result.error) {
        return { success: false, error: result.error, draft: result.draft };
      }

      return {
        success: true,
        orderNumber: result.confirmedOrder?.orderNumber,
        totalUsd: `$${result.confirmedOrder?.calculation.totalUsd}`,
        totalSpokenArabic: centsToLebaneseSpoken(result.confirmedOrder?.calculation.totalCents || 0),
        status: 'Confirmed',
        confirmedAt: result.confirmedOrder?.confirmedAt,
        summaryArabic: result.confirmedOrder?.summaryArabic,
        agentSuccessResponseArabic: `أهلا وسهلا فيك! تثبّت طلبك، ورقم الطلب هو ${result.confirmedOrder?.orderNumber}. المجموع ${centsToLebaneseSpoken(result.confirmedOrder?.calculation.totalCents || 0)}. شكراً لاختيارك بيتنا!`,
      };
    }

    case 'cancel_order': {
      const input = args as CancelOrderInput;
      if (!input.sessionId) {
        return { success: false, error: 'sessionId is required' };
      }
      const result = orderStore.cancelOrder(input.sessionId, input.reason);
      if (result.error) {
        return { success: false, error: result.error, draft: result.draft };
      }
      return {
        success: true,
        status: 'Cancelled',
        agentResponseArabic: 'تكرم، تم إلغاء الطلب ولا يهمك. إذا بتحب تطلب أي شي تاني بأي وقت نحنا بالخدمة!',
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
