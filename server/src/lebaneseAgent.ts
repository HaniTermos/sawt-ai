import { BAYTNA_MENU, COMMON_MODIFIERS, findMenuItemById } from './menuData.js';
import { executeTool } from './tools.js';
import { orderStore, centsToLebaneseSpoken, centsToUsd } from './orderStore.js';

export const LEBANESE_SYSTEM_PROMPT = `
You are the polite, friendly AI receptionist for "Baytna Kitchen" (مطعم بيتنا), a popular authentic Lebanese restaurant.
You take phone and voice orders in warm, natural Lebanese Arabic (اللهجة اللبنانية العامية).
DO NOT use formal Modern Standard Arabic (الفصحى). Use Lebanese vernacular naturally.

Examples of natural Lebanese phrases:
- Greeting: "أهلا وسهلا! معك المساعد الافتراضي لمطعم بيتنا. شو بتحب تطلب اليوم؟"
- Adding items: "أكيد تكرم! بدّك شاورما دجاج وحدة. بتحب نضيفلك بطاطا أو مشروب معها؟"
- Clarification: "بدّك ياها دليفري (توصيل) ولا بتمر تاخدها بيك آب؟"
- If delivery: "ع راسي! لو سمحت شو العنوان بالتفصيل؟"
- Modifiers: "بتحب توم زيادة أو كبيس زيادة مع الشاورما؟"
- Preparing confirmation: "تمام، خلّيني أكّدلك الطلب: [items & prices]. المجموع [total]. طلبك [pickup/delivery]. منثبّت الطلب؟"
- Final confirmation after backend success: "أهلا وسهلا فيك! تثبّت طلبك، ورقم الطلب هو [order number]. المجموع [total]. شكراً لاختيارك بيتنا وبنكون جاهزين قريباً!"
- Cancellation: "تكرم ولا يهمك، ألغيتلك الطلب. إذا بتحب أي شي تاني نحنا بالخدمة!"

MENU ITEMS & EXACT USD PRICES (Source of Truth):
- Chicken Shawarma Wrap (شاورما دجاج): $6.00
- Beef Shawarma Wrap (شاورما لحمة): $7.50
- Falafel Wrap (سندويش فلافل): $5.00
- Hummus (حمص بطحينة): $4.00
- French Fries (بطاطا مقلية): $3.00
- Garlic Sauce (كريم ثوم / توم): $1.00
- Soft Drink (مشروب غازي): $2.00
- Fresh Lemonade (ليموناضة طازجة): $3.00
Standard Delivery fee: $2.50 (Pickup is free $0.00).

CRITICAL OPERATIONAL RULES:
1. Always maintain the cart via tool calls:
   - Call "update_cart" whenever the customer mentions ordering an item, changing quantities, removing an item, or specifying delivery/pickup and address.
2. Never invent items, prices, discounts, or order IDs. The backend is the sole authority on prices.
3. Spoken totals must be phrased in Lebanese dialect matching the exact backend response (e.g. ستّة دولار، سبعة دولار ونص، تسعة دولار).
4. When the customer is done ordering:
   - Ask whether they prefer "بيك آب" (pickup) or "دليفري" (delivery). If delivery, collect their address.
   - Call "prepare_confirmation". This gives you the canonical summary and a confirmationVersion.
   - Read the exact order items, fulfillment method, and USD total back to the customer, and ask explicitly: "منثبّت الطلب؟"
5. DO NOT finalize an order merely because the customer says "okay" or "تمام" while still talking or asking questions.
6. Call "confirm_order" ONLY after:
   - "prepare_confirmation" was called.
   - The customer clearly and explicitly says yes/confirm (e.g. "أكيد", "ثبّت", "نعم", "مظبوط ثبّتلي ياه").
   - Pass explicitConfirmed: true and the exact confirmationVersion returned by prepare_confirmation.
7. Announce the order number ONLY after "confirm_order" succeeds and returns an orderNumber.
8. If the customer asks to cancel, call "cancel_order".
`.trim();

// Intelligent conversational assistant for text chat & fallback demo mode
export async function processCustomerMessage(
  sessionId: string,
  userMessage: string
): Promise<{ textResponse: string; toolCalled?: string; draftState: any }> {
  const text = userMessage.trim().toLowerCase();
  const draft = orderStore.getOrCreateDraft(sessionId);

  // 1. Cancellation check
  if (
    text.includes('إلغاء') ||
    text.includes('الغي') ||
    text.includes('cancel') ||
    text.includes('بطلت بدي') ||
    text.includes('ما بدي شي')
  ) {
    const cancelRes = await executeTool('cancel_order', { sessionId, reason: 'Customer requested' });
    return {
      textResponse: cancelRes.agentResponseArabic || 'تكرم، تم إلغاء الطلب ولا يهمك.',
      toolCalled: 'cancel_order',
      draftState: orderStore.getDraft(sessionId),
    };
  }

  // 2. Explicit Confirmation check
  const isConfirmIntent =
    (text.includes('ثبت') ||
      text.includes('أكيد') ||
      text.includes('اكيد') ||
      text.includes('نعم ثبت') ||
      text.includes('اي ثبت') ||
      text.includes('اي') ||
      text.includes('confirm') ||
      text.includes('yes') ||
      text.includes('مظبوط')) &&
    draft.status === 'Awaiting Confirmation' &&
    draft.items.length > 0;

  if (isConfirmIntent) {
    const confirmRes = await executeTool('confirm_order', {
      sessionId,
      confirmationVersion: draft.confirmationVersion,
      explicitConfirmed: true,
    });

    if (confirmRes.success) {
      return {
        textResponse: confirmRes.agentSuccessResponseArabic,
        toolCalled: 'confirm_order',
        draftState: orderStore.getDraft(sessionId),
      };
    } else {
      return {
        textResponse: `عفواً: ${confirmRes.error}`,
        toolCalled: 'confirm_order',
        draftState: orderStore.getDraft(sessionId),
      };
    }
  }

  // 3. Greeting intent
  const isGreeting =
    text.includes('مرحبا') ||
    text.includes('أهلا') ||
    text.includes('سلام') ||
    text.includes('hello') ||
    text.includes('hi') ||
    text.includes('bonjour') ||
    text === 'صباح الخير' ||
    text === 'مساء الخير';

  if (isGreeting && draft.items.length === 0) {
    return {
      textResponse: 'أهلا وسهلا! معك المساعد الافتراضي لمطعم بيتنا. شو بتحب تطلب اليوم؟ عندنا شاورما دجاج، شاورما لحمة، فلافل، حمص، بطاطا مقلية وعصاير طازجة!',
      draftState: draft,
    };
  }

  // 4. Menu Inquiry
  if (
    text.includes('منيو') ||
    text.includes('menu') ||
    text.includes('شو عندكم') ||
    text.includes('شو في أكل') ||
    text.includes('الأسعار')
  ) {
    const menuRes = await executeTool('get_menu', {});
    const itemsList = menuRes.items
      .map((i: any) => `• ${i.nameArabic} (${i.name}): ${i.priceUsd}`)
      .join('\n');
    return {
      textResponse: `أكيد تكرم! هاي قائمة مطعم بيتنا (Baytna Kitchen):\n${itemsList}\nشو بتحب نجهّزلك منها؟`,
      toolCalled: 'get_menu',
      draftState: draft,
    };
  }

  // 5. Detect fulfillment & address
  let detectedFulfillment: 'pickup' | 'delivery' | undefined;
  let detectedAddress: string | undefined;

  if (text.includes('توصيل') || text.includes('دليفري') || text.includes('delivery')) {
    detectedFulfillment = 'delivery';
    // extract address if mentioned
    const addressMatch = text.match(/(عنواني|العنوان|بـ|في|شارع|بمنطقة)\s+(.+)/);
    if (addressMatch && addressMatch[2]) {
      detectedAddress = addressMatch[2].trim();
    }
  } else if (text.includes('بيك آب') || text.includes('pickup') || text.includes('باخده من المحل') || text.includes('سفري')) {
    detectedFulfillment = 'pickup';
  }

  // 6. Detect Quantity
  let quantity = 1;
  if (text.includes('تنين') || text.includes('اتنين') || text.includes('2') || text.includes('اثنان')) {
    quantity = 2;
  } else if (text.includes('تلاتة') || text.includes('3') || text.includes('ثلاثة')) {
    quantity = 3;
  } else if (text.includes('أربعة') || text.includes('اربعه') || text.includes('4')) {
    quantity = 4;
  } else if (text.includes('خمسة') || text.includes('5')) {
    quantity = 5;
  }

  // 7. Detect Modifiers
  const modifierIds: string[] = [];
  if (text.includes('توم زيادة') || text.includes('ثوم زيادة') || text.includes('extra garlic')) {
    modifierIds.push('extra_garlic');
  }
  if (text.includes('كبيس زيادة') || text.includes('مخلل') || text.includes('extra pickles')) {
    modifierIds.push('extra_pickles');
  }
  if (text.includes('حار') || text.includes('حر') || text.includes('spicy') || text.includes('شطة')) {
    modifierIds.push('spicy');
  }
  if (text.includes('طحينة زيادة') || text.includes('extra tahini')) {
    modifierIds.push('extra_tahini');
  }
  if (text.includes('دايت') || text.includes('diet')) {
    modifierIds.push('diet_coke');
  } else if (text.includes('سبرايت') || text.includes('sprite')) {
    modifierIds.push('sprite');
  } else if (text.includes('كولا') || text.includes('coke') || text.includes('بيبسي')) {
    modifierIds.push('coke');
  }

  // 8. Detect Menu Items
  let matchedItemId: string | undefined;

  if (text.includes('شاورما دجاج') || text.includes('chicken shawarma') || text.includes('دجاج')) {
    matchedItemId = 'chicken_shawarma';
  } else if (text.includes('شاورما لحمة') || text.includes('beef shawarma') || text.includes('لحمة')) {
    matchedItemId = 'beef_shawarma';
  } else if (text.includes('فلافل') || text.includes('falafel')) {
    matchedItemId = 'falafel_wrap';
  } else if (text.includes('حمص') || text.includes('hummus')) {
    matchedItemId = 'hummus';
  } else if (text.includes('بطاطا') || text.includes('fries') || text.includes('french fries')) {
    matchedItemId = 'french_fries';
  } else if (text.includes('توم') || text.includes('ثوم') || text.includes('garlic sauce')) {
    matchedItemId = 'garlic_sauce';
  } else if (text.includes('ليموناضة') || text.includes('lemonade') || text.includes('عصير')) {
    matchedItemId = 'fresh_lemonade';
  } else if (text.includes('مشروب') || text.includes('بيبسي') || text.includes('كولا') || text.includes('soft drink')) {
    matchedItemId = 'soft_drink';
  }

  // Check for item removal
  const isRemove = text.includes('شيل') || text.includes('احذف') || text.includes('بلا') || text.includes('remove');
  if (isRemove && matchedItemId) {
    const updateRes = await executeTool('update_cart', {
      sessionId,
      action: 'remove',
      menuItemId: matchedItemId,
    });
    return {
      textResponse: `تكرم، شلت ${matchedItemId} من الطلب. المجموع هلق: ${updateRes.totalUsd} (${updateRes.totalSpokenArabic}). بتحب تضيف أي شي تاني؟`,
      toolCalled: 'update_cart',
      draftState: updateRes.draft,
    };
  }

  // If item matched, add to cart
  if (matchedItemId) {
    const updateRes = await executeTool('update_cart', {
      sessionId,
      action: 'add',
      menuItemId: matchedItemId,
      quantity,
      modifierIds: modifierIds.length > 0 ? modifierIds : undefined,
      fulfillment: detectedFulfillment,
      customerAddress: detectedAddress,
    });

    const itemObj = BAYTNA_MENU.find((m) => m.id === matchedItemId);
    const itemNameAr = itemObj ? itemObj.nameArabic : matchedItemId;

    let responseText = `تكرم! ضفتلك ${quantity > 1 ? `${quantity} ` : ''}${itemNameAr}`;
    if (modifierIds.length > 0) {
      responseText += ` مع إضافات (${modifierIds.map((m) => COMMON_MODIFIERS[m]?.nameArabic).join('، ')})`;
    }
    responseText += `. المجموع حتى الآن ${updateRes.totalUsd} (${updateRes.totalSpokenArabic}). بتحب تضيف بطاطا مقلية أو مشروب مع الطلب؟ ولا بتحب تأكّد؟`;

    return {
      textResponse: responseText,
      toolCalled: 'update_cart',
      draftState: updateRes.draft,
    };
  }

  // Fulfillment / Address update
  if (detectedFulfillment || detectedAddress) {
    const updateRes = await executeTool('update_cart', {
      sessionId,
      action: 'update',
      fulfillment: detectedFulfillment,
      customerAddress: detectedAddress,
    });

    if (detectedFulfillment === 'delivery' && !updateRes.draft.customer.address) {
      return {
        textResponse: 'ع راسي، طلبك دليفري (توصيل). يا ريت تعطيني العنوان ورقم التلفون حتى نوصّلك ياه بالوقت المحدد؟',
        toolCalled: 'update_cart',
        draftState: updateRes.draft,
      };
    }
  }

  // 9. Request to confirm / finalize / checkout
  if (
    text.includes('خلص') ||
    text.includes('هيك تمام') ||
    text.includes('أكد') ||
    text.includes('اكّد') ||
    text.includes('checkout') ||
    text.includes('احسبلي') ||
    text.includes('المجموع') ||
    text.includes('جاهز')
  ) {
    if (draft.items.length === 0) {
      return {
        textResponse: 'السلة بعدا فاضية! شو بتحب تطلب لحتى سجلك ياه؟',
        draftState: draft,
      };
    }

    if (draft.fulfillment === 'delivery' && !draft.customer.address) {
      return {
        textResponse: 'أكيد تكرم! بما إنو الطلب دليفري، يا ريت تذكرلي العنوان لو سمحت؟',
        draftState: draft,
      };
    }

    const prepRes = await executeTool('prepare_confirmation', {
      sessionId,
      fulfillment: draft.fulfillment,
    });

    if (prepRes.success) {
      return {
        textResponse: `${prepRes.summaryArabic} منثبّت الطلب؟`,
        toolCalled: 'prepare_confirmation',
        draftState: orderStore.getDraft(sessionId),
      };
    } else {
      return {
        textResponse: `عفواً، ${prepRes.error}`,
        toolCalled: 'prepare_confirmation',
        draftState: orderStore.getDraft(sessionId),
      };
    }
  }

  // Fallback polite guidance
  if (draft.items.length > 0) {
    return {
      textResponse: `معك المساعد الافتراضي لمطعم بيتنا. بطلبك حالياً: ${draft.items.map((i) => `${i.quantity} ${i.nameArabic}`).join('، ')}. المجموع: $${draft.calculation.totalUsd} (${centsToLebaneseSpoken(draft.calculation.totalCents)}). بتحب تضيف شي تاني أو بدك نأكّد الطلب؟`,
      draftState: draft,
    };
  }

  return {
    textResponse: 'أهلاً وسهلاً بمطعم بيتنا! بقدر سجلك أي طلب بتحبه من المنيو: شاورما، فلافل، حمص، بطاطا ومشروبات. شو بتحب تطلب؟',
    draftState: draft,
  };
}
