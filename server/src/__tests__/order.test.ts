import { describe, it, expect, beforeEach } from 'vitest';
import { OrderStore } from '../orderStore.js';
import { executeTool } from '../tools.js';

describe('Baytna Kitchen Order System Tests', () => {
  let store: OrderStore;
  const testSessionId = 'test-session-123';

  beforeEach(() => {
    store = new OrderStore();
  });

  describe('1. Price Calculation (Integer Cents)', () => {
    it('calculates correct subtotal, pickup fee, and line totals for multiple items', () => {
      // Add Chicken Shawarma Wrap ($6.00 = 600 cents)
      const res1 = store.updateCartItem(testSessionId, 'add', 'chicken_shawarma', undefined, 2);
      expect(res1.error).toBeUndefined();
      expect(res1.draft.calculation.subtotalCents).toBe(1200);
      expect(res1.draft.calculation.deliveryFeeCents).toBe(0);
      expect(res1.draft.calculation.totalCents).toBe(1200);
      expect(res1.draft.calculation.totalUsd).toBe('12.00');

      // Add French Fries ($3.00 = 300 cents) with Extra Garlic ($1.00 = 100 cents)
      const res2 = store.updateCartItem(
        testSessionId,
        'add',
        'french_fries',
        undefined,
        1,
        ['extra_garlic']
      );
      expect(res2.error).toBeUndefined();
      // 1200 + (300 + 100) = 1600 cents
      expect(res2.draft.calculation.subtotalCents).toBe(1600);
      expect(res2.draft.calculation.totalCents).toBe(1600);
      expect(res2.draft.calculation.totalUsd).toBe('16.00');

      // Switch to delivery ($2.50 = 250 cents)
      const res3 = store.updateCartItem(
        testSessionId,
        'update',
        undefined,
        undefined,
        undefined,
        undefined,
        'delivery',
        'Beirut, Hamra Street'
      );
      expect(res3.draft.calculation.deliveryFeeCents).toBe(250);
      expect(res3.draft.calculation.totalCents).toBe(1850);
      expect(res3.draft.calculation.totalUsd).toBe('18.50');
    });

    it('accurately calculates Beef Shawarma ($7.50) + Lemonade ($3.00)', () => {
      store.updateCartItem(testSessionId, 'add', 'beef_shawarma', undefined, 1);
      store.updateCartItem(testSessionId, 'add', 'fresh_lemonade', undefined, 1);
      const draft = store.getDraft(testSessionId)!;
      // 750 + 300 = 1050 cents ($10.50)
      expect(draft.calculation.subtotalCents).toBe(1050);
      expect(draft.calculation.totalUsd).toBe('10.50');
    });
  });

  describe('2. Invalid Menu Items', () => {
    it('rejects adding an unknown menu item ID and prevents invalid state', () => {
      const res = store.updateCartItem(testSessionId, 'add', 'non_existent_burger', undefined, 1);
      expect(res.error).toBeDefined();
      expect(res.error).toContain('not found in Baytna Kitchen menu');
      expect(res.draft.items.length).toBe(0);
      expect(res.draft.calculation.totalCents).toBe(0);
    });
  });

  describe('3. Stale Confirmation Version Rejection', () => {
    it('rejects confirmation if items were modified after preparing confirmation', () => {
      // 1. Add Falafel wrap ($5.00)
      store.updateCartItem(testSessionId, 'add', 'falafel_wrap', undefined, 1);

      // 2. Prepare confirmation and get initial confirmationVersion
      const prep1 = store.prepareConfirmation(testSessionId, 'pickup');
      expect(prep1.error).toBeUndefined();
      const oldVersion = prep1.confirmationVersion;
      expect(prep1.draft.status).toBe('Awaiting Confirmation');

      // 3. Customer modifies order: adds Hummus ($4.00)
      store.updateCartItem(testSessionId, 'add', 'hummus', undefined, 1);

      // Now draft confirmationVersion has changed!
      const currentDraft = store.getDraft(testSessionId)!;
      expect(currentDraft.confirmationVersion).not.toBe(oldVersion);

      // 4. Attempt to confirm with oldVersion must be rejected!
      const confirmAttempt = store.confirmOrder(testSessionId, oldVersion, true);
      expect(confirmAttempt.error).toBeDefined();
      expect(confirmAttempt.error).toContain('Stale confirmation version');
      expect(confirmAttempt.confirmedOrder).toBeUndefined();
      expect(confirmAttempt.draft.status).not.toBe('Confirmed');

      // 5. Preparing new confirmation allows successful finalize
      const prep2 = store.prepareConfirmation(testSessionId, 'pickup');
      const validConfirm = store.confirmOrder(testSessionId, prep2.confirmationVersion, true);
      expect(validConfirm.error).toBeUndefined();
      expect(validConfirm.confirmedOrder).toBeDefined();
      expect(validConfirm.draft.status).toBe('Confirmed');
      expect(validConfirm.confirmedOrder?.calculation.totalCents).toBe(900); // 500 + 400
    });

    it('rejects confirmation if delivery address is missing', () => {
      store.updateCartItem(testSessionId, 'add', 'chicken_shawarma', undefined, 1);
      // Attempt prepare delivery without address
      const prep = store.prepareConfirmation(testSessionId, 'delivery', '');
      expect(prep.error).toContain('Delivery orders require a valid delivery address');
    });
  });

  describe('4. Order Cancellation Safety', () => {
    it('safely cancels uncommitted draft orders and clears cart', () => {
      store.updateCartItem(testSessionId, 'add', 'chicken_shawarma', undefined, 1);
      expect(store.getDraft(testSessionId)!.items.length).toBe(1);

      const cancelRes = store.cancelOrder(testSessionId, 'Customer changed mind');
      expect(cancelRes.error).toBeUndefined();
      expect(cancelRes.draft.status).toBe('Cancelled');
      expect(cancelRes.draft.items.length).toBe(0);
      expect(cancelRes.draft.calculation.totalCents).toBe(0);
    });

    it('refuses direct silent cancellation of an already confirmed order', () => {
      store.updateCartItem(testSessionId, 'add', 'hummus', undefined, 1);
      const prep = store.prepareConfirmation(testSessionId, 'pickup');
      const conf = store.confirmOrder(testSessionId, prep.confirmationVersion, true);
      expect(conf.confirmedOrder).toBeDefined();

      // Attempt to cancel confirmed order directly
      const cancelAttempt = store.cancelOrder(testSessionId, 'Try cancel');
      expect(cancelAttempt.error).toBeDefined();
      expect(cancelAttempt.error).toContain('Cannot cancel an already confirmed order directly');
      expect(store.getDraft(testSessionId)!.status).toBe('Confirmed');
    });
  });

  describe('5. Duplicate Confirmation Idempotency', () => {
    it('returns the same order without creating duplicate orders or modifying orderNumber', () => {
      store.updateCartItem(testSessionId, 'add', 'beef_shawarma', undefined, 1);
      const prep = store.prepareConfirmation(testSessionId, 'pickup');

      // First confirmation
      const firstConfirm = store.confirmOrder(testSessionId, prep.confirmationVersion, true);
      expect(firstConfirm.error).toBeUndefined();
      const firstOrderNumber = firstConfirm.confirmedOrder!.orderNumber;
      expect(firstOrderNumber).toMatch(/^BYT-\d+$/);

      // Immediate duplicate confirmation call with same parameters
      const duplicateConfirm = store.confirmOrder(testSessionId, prep.confirmationVersion, true);
      expect(duplicateConfirm.error).toBeUndefined();
      expect(duplicateConfirm.confirmedOrder!.orderNumber).toBe(firstOrderNumber);

      // Verify recent orders list only has 1 record for this order
      const recent = store.getRecentOrders();
      const matching = recent.filter((o) => o.orderNumber === firstOrderNumber);
      expect(matching.length).toBe(1);
    });
  });
});
