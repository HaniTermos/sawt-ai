# SAWT AI - Lebanese AI Restaurant Receptionist (Baytna Kitchen)

A single-page, responsive web application featuring an AI voice and text receptionist speaking authentic **Lebanese Arabic** for a fictional restaurant named **Baytna Kitchen (مطعم بيتنا)**.

Built with **React + TypeScript + Vite**, **Node.js + Express + TypeScript**, **OpenAI Realtime API (WebRTC)**, and an authoritative **integer-cents** ordering store.

---

## 🌟 Key Features

1. **One-Page Premium Dashboard**:
   - Modern restaurant-tech aesthetic: dark charcoal background (`#0c0d11`), warm cream typography (`#f7f4ee`), subtle orange accents (`#f97316`), and glassmorphism.
   - Fits on a single cohesive page without page reloads or route navigation.
2. **Authentic Lebanese Arabic AI Voice & Dialogue**:
   - Speaks colloquial Lebanese Arabic (e.g., *"أهلا وسهلا! معك المساعد الافتراضي لمطعم بيتنا. شو بتحب تطلب اليوم؟"*).
   - Never uses rigid formal Modern Standard Arabic (الفصحى).
   - Generates natural Lebanese spoken prices (e.g., *"ستّة دولار"*, *"سبعة دولار ونص"*, *"تسعة دولار"*).
3. **OpenAI Realtime API over WebRTC**:
   - Live browser WebRTC audio session using ephemeral token generation via backend `/api/session`.
   - Never exposes permanent OpenAI keys to the client.
   - Interruption detection, live transcript streaming, and bidirectional tool calling.
4. **Dual Mode (Voice & Interactive Text Demo)**:
   - When `OPENAI_API_KEY` is configured: Full live WebRTC audio conversation.
   - When `OPENAI_API_KEY` is not present: Seamless fallback to interactive Lebanese Arabic text ordering with browser speech synthesis on the exact same backend engine.
5. **Authoritative Backend Order Safety**:
   - Calculations performed strictly in **integer cents** (preventing floating point errors).
   - State machine: `Draft` ➔ `Awaiting Confirmation` ➔ `Confirmed` (or `Cancelled`).
   - Confirmation versioning tokens (`confirmationVersion`) that reject stale cart updates.
   - Idempotent `confirm_order` preventing duplicate orders.
   - Explicit confirmation requirement: only persists order after customer explicitly agrees.
   - Order number banner displayed only after successful persistence.
6. **In-Memory Demo Store**:
   - Fictional demonstration data. Resets upon server restart. Structured for easy migration to PostgreSQL or MongoDB.
   - Compact recent-orders panel showing confirmed demo orders with timestamp, fulfillment method, items, and USD total.

---

## 🍽️ Baytna Kitchen Demo Menu (Exact USD Source of Truth)

| Item Name (English) | Item Name (Arabic) | Category | Exact Price (USD) | Integer Cents |
| :--- | :--- | :--- | :--- | :--- |
| **Chicken Shawarma Wrap** | شاورما دجاج | Wraps | **$6.00** | 600¢ |
| **Beef Shawarma Wrap** | شاورما لحمة | Wraps | **$7.50** | 750¢ |
| **Falafel Wrap** | سندويش فلافل | Wraps | **$5.00** | 500¢ |
| **Hummus** | حمص بطحينة | Sides | **$4.00** | 400¢ |
| **French Fries** | بطاطا مقلية | Sides | **$3.00** | 300¢ |
| **Garlic Sauce** | كريم ثوم (توم) | Sides | **$1.00** | 100¢ |
| **Soft Drink** | مشروب غازي | Beverages | **$2.00** | 200¢ |
| **Fresh Lemonade** | ليموناضة طازجة | Beverages | **$3.00** | 300¢ |

- **Fulfillment**: Pickup ($0.00 delivery fee) or Standard Delivery ($2.50 delivery fee).
- **Supported Modifiers**: Extra Garlic Sauce (+$1.00), Extra Pickles (+$0.50), Spicy/Harissa (+$0.50), Extra Tahini (+$0.50), Soda flavors (Coke, Diet Coke, Sprite).

---

## 🛠️ Backend Tools Specification

The backend provides 6 authoritative tools called by both the voice agent data channel and the text ordering engine:

1. `get_menu`: Returns trusted items, descriptions, and USD prices in integer cents.
2. `update_cart`: Validates menu item IDs, quantities, modifiers, fulfillment method, and recalculates line totals and subtotal.
3. `calculate_order`: Computes itemized subtotal, delivery fee, and final USD total.
4. `prepare_confirmation`: Generates canonical order summary in Lebanese Arabic & English, updates status to `Awaiting Confirmation`, and produces a unique `confirmationVersion`.
5. `confirm_order`: Verifies matching `confirmationVersion`, requires `explicitConfirmed: true`, validates delivery address if applicable, assigns order number (e.g. `BYT-1001`), saves to demo store, and returns final record. Idempotent on repeated calls.
6. `cancel_order`: Safely cancels uncommitted draft orders and clears cart. Rejects cancellation of already confirmed orders without amendment flow.

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
- **Node.js** >= 18.0.0 (Tested on Node.js v22.18.0)
- **npm** >= 9.0.0

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env`:
```ini
# OpenAI API Key (Required for live browser WebRTC voice)
# If left blank, the app runs in full interactive text & speech demo mode.
OPENAI_API_KEY=your_openai_api_key_here

# Server Port
PORT=3001

# Optional: Default Realtime voice (e.g., alloy, verse, shimmer, ash, coral)
OPENAI_REALTIME_VOICE=alloy
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Automated Tests
```bash
npm test
```
Runs 8 automated Vitest tests covering:
- Integer-cents price calculation with multiple items and modifiers
- Rejection of invalid menu item IDs
- Rejection of stale confirmation versions
- Missing delivery address rejection
- Safe draft cancellation & refusal to silently cancel confirmed orders
- Duplicate confirmation idempotency

### 5. Launch in Development Mode
```bash
npm run dev
```
Starts backend API server with live reloading and Vite dev server concurrently.
Open `http://localhost:5173` in your browser.

### 6. Build & Launch in Production Mode
```bash
# Build frontend and server
npm run build

# Start production server
npm start
```
Open `http://localhost:3001` in your browser. The Express server serves both the REST API, Realtime WebRTC session endpoint, and the optimized production frontend bundle from one port.

---

## 🧪 Testing the Application

### Testing by Voice (When `OPENAI_API_KEY` is provided)
1. Click **Start Conversation**.
2. Allow browser microphone access when prompted.
3. The orb turns blue (Listening). Speak in Lebanese Arabic:
   - *"مرحبا! بدي 2 شاورما دجاج مع توم زيادة وبطاطا مقلية."*
4. The receptionist answers back with spoken prices:
   - *"أكيد تكرم! ضفتلك 2 شاورما دجاج مع توم زيادة وبطاطا مقلية. المجموع 16 دولار..."*
5. Request confirmation:
   - *"تمام، احسبلي ياهن بيك آب."*
6. When the receptionist reads back the total and asks *"منثبّت الطلب؟"*, answer:
   - *"أكيد ثبّت الطلب."*
7. Hear the confirmation, receive your order number (e.g. **BYT-1001**), and observe the confirmed order appear in the Recent Orders panel.

### Testing by Text Console (No API key needed)
1. Use the text input or click any of the Lebanese suggestion chips (e.g., *"بدي شاورما دجاج وحدة وبطاطا مقلية"*).
2. Click **إرسال** (Send).
3. Watch the interactive cart calculate subtotal and delivery fee in real-time.
4. Click *"احسبلي المجموع وخلّينا نأكّد الطلب"*.
5. Click *"أكيد ثبّت الطلب"* to finalize. The order number banner appears and the order is added to the Recent Orders panel.

---

## 🔒 Security & Architecture Notes

- **Secrets Kept Server-Side**: The browser only receives short-lived ephemeral session tokens from `/api/session`. Permanent `OPENAI_API_KEY` is never exposed.
- **Authoritative Calculations**: Clients never dictate line totals or order totals. All prices and math are calculated in integer cents on the backend.
- **Rate Limiting & Input Validation**: Basic rate limiting and request body validation prevent spam and malformed requests.
