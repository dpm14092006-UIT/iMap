import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

const variantClasses = {
  primary: 'ui-button-primary',
  secondary: 'ui-button-secondary',
  ghost: 'ui-button-ghost',
  danger: 'ui-button-danger',
} as const;

/** Native button semantics, consistent focus/disabled states and an explicit submit opt-in. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { type = 'button', variant = 'primary', loading = false, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || props['aria-busy']}
      className={`ui-button ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
});
