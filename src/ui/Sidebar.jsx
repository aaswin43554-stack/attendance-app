import React from 'react';

export default function Sidebar({ title = "Menu", items, activeItem, onChange }) {
  return (
    <aside className="sidebar">
      {title && <div className="sidebar-title">{title}</div>}
      {items.map(item => (
        <div 
          key={item.id} 
          className={`sidebar-item ${activeItem === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </aside>
  );
}
