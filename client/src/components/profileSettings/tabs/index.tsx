import * as React from 'react';
import './index.css';

interface TabItem {
  id: string;
  label: string;
}

interface TabsHeaderProps {
  items: TabItem[];
  active: string;
  setActive: (id: string) => void;
}

/**
 * Modern tab navigation header
 */
export const TabsHeader: React.FC<TabsHeaderProps> = ({ items, active, setActive }) => {
  return (
    <div className='tabs-header'>
      {items.map(item => (
        <button
          key={item.id}
          className={`tab ${active === item.id ? 'tab--active' : ''}`}
          onClick={() => setActive(item.id)}
          type='button'>
          {item.label}
        </button>
      ))}
    </div>
  );
};

interface TabPanelProps {
  id: string;
  active: string;
  children: React.ReactNode;
}

/**
 * Tab panel content container
 */
export const TabPanel: React.FC<TabPanelProps> = ({ id, active, children }) => {
  if (id !== active) return null;

  return <div className='tab-panel'>{children}</div>;
};
