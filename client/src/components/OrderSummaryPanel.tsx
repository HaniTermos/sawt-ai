import React from 'react';
import { ShoppingBag, CheckCircle2, Clock, MapPin, Store, AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import { DraftOrder, FulfillmentType } from '../types.js';

interface OrderSummaryPanelProps {
  draft: DraftOrder | null;
  onUpdateFulfillment: (type: FulfillmentType, address?: string) => void;
  onClearCart: () => void;
}

export const OrderSummaryPanel: React.FC<OrderSummaryPanelProps> = ({
  draft,
  onUpdateFulfillment,
  onClearCart,
}) => {
  const items = draft?.items || [];
  const status = draft?.status || 'Draft';
  const calculation = draft?.calculation || {
    subtotalUsd: '0.00',
    deliveryFeeUsd: '0.00',
    totalUsd: '0.00',
    itemCount: 0,
    subtotalCents: 0,
    deliveryFeeCents: 0,
    totalCents: 0,
  };
  const fulfillment = draft?.fulfillment || 'pickup';
  const isDelivery = fulfillment === 'delivery';
  const isConfirmed = status === 'Confirmed' && Boolean(draft?.orderNumber);

  const getStatusBadge = () => {
    switch (status) {
      case 'Awaiting Confirmation':
        return <span className="status-pill Awaiting-Confirmation">Awaiting Confirmation</span>;
      case 'Confirmed':
        return <span className="status-pill Confirmed">Confirmed</span>;
      case 'Cancelled':
        return <span className="status-pill Cancelled">Cancelled</span>;
      default:
        return <span className="status-pill Draft">Draft</span>;
    }
  };

  return (
    <div className="glass-panel order-summary-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title">
          <ShoppingBag size={20} className="text-orange-500" />
          <span>Interactive Order Summary</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {getStatusBadge()}
          {items.length > 0 && status !== 'Confirmed' && (
            <button
              onClick={onClearCart}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#fca5a5' }}
              title="Clear cart"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Confirmed Order Hero Banner (Displayed ONLY after successful save) */}
      {isConfirmed && (
        <div className="confirmed-callout">
          <div className="confirmed-callout-text">
            <h4>Order Persisted & Confirmed</h4>
            <div className="order-num">{draft.orderNumber}</div>
            <div style={{ fontSize: '0.78rem', color: '#a7f3d0', marginTop: 4 }}>
              Saved in demo store • Exact total: ${calculation.totalUsd} USD
            </div>
          </div>
          <CheckCircle2 size={42} className="text-emerald-400" />
        </div>
      )}

      {/* Fulfillment Toggle */}
      <div className="fulfillment-tabs">
        <button
          type="button"
          className={`fulfillment-tab ${!isDelivery ? 'active' : ''}`}
          onClick={() => onUpdateFulfillment('pickup')}
          disabled={status === 'Confirmed'}
        >
          <Store size={16} />
          <span>Pickup (استلام) • $0.00</span>
        </button>
        <button
          type="button"
          className={`fulfillment-tab ${isDelivery ? 'active' : ''}`}
          onClick={() => onUpdateFulfillment('delivery', draft?.customer.address || 'Beirut')}
          disabled={status === 'Confirmed'}
        >
          <MapPin size={16} />
          <span>Delivery (توصيل) • $2.50</span>
        </button>
      </div>

      {/* Delivery Address Input */}
      {isDelivery && (
        <div className="delivery-address-box">
          <label>Delivery Address (عنوان التوصيل)</label>
          <input
            type="text"
            placeholder="أدخل عنوان التوصيل (مثال: شارع الحمرا، بناية النور)..."
            value={draft?.customer.address || ''}
            onChange={(e) => onUpdateFulfillment('delivery', e.target.value)}
            disabled={status === 'Confirmed'}
            style={{ direction: 'rtl', fontFamily: 'var(--font-arabic)' }}
          />
        </div>
      )}

      {/* Itemized Order List */}
      <div className="items-table">
        {items.length === 0 ? (
          <div className="empty-cart-state">
            <ShoppingBag size={28} opacity={0.3} />
            <p style={{ fontSize: '0.88rem' }}>Cart is currently empty.</p>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Speak to the AI receptionist or use the quick buttons below to add Baytna items.
            </span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="cart-item-row">
              <div className="item-left">
                <div className="item-title-row">
                  <span className="item-qty-badge">{item.quantity}x</span>
                  <span className="item-name">{item.name}</span>
                </div>
                <div className="item-name-ar">{item.nameArabic}</div>
                {item.modifiers.length > 0 && (
                  <div className="item-modifiers">
                    {item.modifiers.map((m) => (
                      <span key={m.id}>
                        +{m.nameArabic} (+${(m.priceCents / 100).toFixed(2)})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="item-right">
                <div className="item-total-price">
                  ${(item.lineTotalCents / 100).toFixed(2)}
                </div>
                <div className="item-unit-price">
                  ${(item.unitPriceCents / 100).toFixed(2)} ea
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pricing Breakdown */}
      <div className="pricing-breakdown">
        <div className="price-row">
          <span>Subtotal ({calculation.itemCount} items)</span>
          <span>${calculation.subtotalUsd}</span>
        </div>

        <div className="price-row">
          <span>Delivery Fee ({isDelivery ? 'Standard Delivery' : 'Pickup'})</span>
          <span>${calculation.deliveryFeeUsd}</span>
        </div>

        <div className="price-row total-row">
          <span>Final USD Total</span>
          <span className="total-usd-highlight">${calculation.totalUsd}</span>
        </div>
      </div>
    </div>
  );
};
