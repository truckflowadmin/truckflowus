'use client';

/**
 * Broker select that toggles the customer field and name label
 * when a broker is selected. Used in SA job forms.
 */
export default function BrokerToggleSelect({
  name,
  defaultValue,
  className,
  customerWrapClass,
  nameLabelClass,
  nameLabelBroker,
  nameLabelDefault,
  children,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  /** CSS class on the customer wrapper div to show/hide */
  customerWrapClass: string;
  /** CSS class on the name label to update */
  nameLabelClass: string;
  /** Text to show on name label when broker IS selected */
  nameLabelBroker: string;
  /** Text to show on name label when broker is NOT selected */
  nameLabelDefault: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => {
        const form = e.currentTarget.closest('form');
        if (!form) return;
        const custWrap = form.querySelector(`.${customerWrapClass}`) as HTMLElement | null;
        const nameLabel = form.querySelector(`.${nameLabelClass}`) as HTMLElement | null;
        if (e.currentTarget.value) {
          // Broker selected — hide customer, change label
          if (custWrap) {
            custWrap.style.display = 'none';
            const sel = custWrap.querySelector('select');
            if (sel) sel.value = '';
          }
          if (nameLabel) nameLabel.textContent = nameLabelBroker;
        } else {
          // No broker — show customer, restore label
          if (custWrap) custWrap.style.display = '';
          if (nameLabel) nameLabel.textContent = nameLabelDefault;
        }
      }}
    >
      {children}
    </select>
  );
}
