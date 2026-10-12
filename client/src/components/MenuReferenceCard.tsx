import React from 'react';
import { Utensils, Plus, Info } from 'lucide-react';
import { MenuItem } from '../types.js';

interface MenuReferenceCardProps {
  items: MenuItem[];
  onQuickAddItem: (menuItemId: string) => void;
  disabled?: boolean;
}

export const MenuReferenceCard: React.FC<MenuReferenceCardProps> = ({
  items,
  onQuickAddItem,
  disabled,
}) => {
  return (
    <div className="glass-panel menu-reference-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Utensils size={18} className="text-orange-400" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            Baytna Kitchen Menu (قائمة بيتنا)
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Info size={12} />
          Fictional Demonstration Data • Exact USD Source of Truth
        </span>
      </div>

      <div className="menu-items-grid">
        {items.map((item) => (
          <div
            key={item.id}
            className="menu-item-chip"
            onClick={() => !disabled && onQuickAddItem(item.id)}
            title={`Click to add 1x ${item.name} ($${(item.priceCents / 100).toFixed(2)})`}
          >
            <div>
              <div className="menu-item-chip-name">{item.name}</div>
              <div className="menu-item-chip-name-ar">{item.nameArabic}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="menu-item-chip-price">${(item.priceCents / 100).toFixed(2)}</span>
              <Plus size={14} className="text-orange-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
