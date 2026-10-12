import React from 'react';
import { History, CheckCircle, Clock, MapPin, Store } from 'lucide-react';
import { ConfirmedOrderRecord } from '../types.js';

interface RecentOrdersPanelProps {
  orders: ConfirmedOrderRecord[];
  onRefresh: () => void;
}

export const RecentOrdersPanel: React.FC<RecentOrdersPanelProps> = ({ orders, onRefresh }) => {
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-panel recent-orders-panel">
      <div className="panel-header" style={{ paddingBottom: 10 }}>
        <div className="panel-title" style={{ fontSize: '1rem' }}>
          <History size={18} className="text-orange-400" />
          <span>Recent Demo Orders</span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          In-Memory Store ({orders.length} saved)
        </span>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Orders saved this session upon customer confirmation. Resets when server restarts.
      </div>

      <div className="recent-orders-list">
        {orders.length === 0 ? (
          <div className="empty-cart-state" style={{ padding: '24px 10px' }}>
            <Clock size={24} opacity={0.3} />
            <p style={{ fontSize: '0.82rem' }}>No orders confirmed yet.</p>
            <span style={{ fontSize: '0.74rem' }}>
              Confirm an order by voice or text to see it saved here in real-time.
            </span>
          </div>
        ) : (
          orders.map((ord) => {
            const isDelivery = ord.fulfillment === 'delivery';
            const itemsText = ord.items
              .map((i) => `${i.quantity}x ${i.name}`)
              .join(', ');

            return (
              <div key={ord.orderNumber} className="recent-order-card">
                <div className="recent-order-meta">
                  <div className="recent-order-title">
                    <span style={{ color: '#fff' }}>{ord.orderNumber}</span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isDelivery ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                        color: isDelivery ? '#7dd3fc' : '#cbd5e1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {isDelivery ? <MapPin size={10} /> : <Store size={10} />}
                      {isDelivery ? 'Delivery' : 'Pickup'}
                    </span>
                  </div>

                  <div className="recent-order-items-snippet">{itemsText}</div>

                  <div className="recent-order-time">
                    {formatTime(ord.confirmedAt)} • Status: {ord.status}
                  </div>
                </div>

                <div className="recent-order-total">${ord.calculation.totalUsd}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
