import { useId, useState, PropsWithChildren, KeyboardEvent } from 'react';

type TabItem = { id: string; label: string };

export function useTabs<T extends string>(initial: T) {
  const [active, setActive] = useState<T>(initial);
  return { active, setActive };
}

export function TabsHeader({
  items,
  active,
  setActive,
}: {
  items: TabItem[];
  active: string;
  setActive: (id: string) => void;
}) {
  const tablistId = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex(t => t.id === active);
    if (e.key === 'ArrowRight') setActive(items[(idx + 1) % items.length].id);
    if (e.key === 'ArrowLeft') setActive(items[(idx - 1 + items.length) % items.length].id);
  };

  return (
    <div
      role='tablist'
      aria-label='Profile sections'
      id={tablistId}
      className='tabs-header'
      onKeyDown={onKeyDown}>
      {items.map(t => (
        <button
          key={t.id}
          role='tab'
          aria-selected={active === t.id}
          aria-controls={`${t.id}-panel`}
          className={`tab ${active === t.id ? 'tab--active' : ''}`}
          onClick={() => setActive(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  id,
  active,
  children,
}: PropsWithChildren<{ id: string; active: string }>) {
  return (
    <div
      role='tabpanel'
      id={`${id}-panel`}
      aria-labelledby={id}
      hidden={active !== id}
      className='tab-panel'>
      {children}
    </div>
  );
}
