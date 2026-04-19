'use client';

/**
 * A <select> that auto-submits its parent form when the value changes.
 * Drop-in replacement for <select onChange="this.form.requestSubmit()">
 * which doesn't work in React (string onChange handlers are invalid).
 */
export default function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => {
        const form = e.currentTarget.closest('form');
        if (form) form.requestSubmit();
      }}
    >
      {children}
    </select>
  );
}
