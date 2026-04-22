import { forwardRef } from 'react';

// Button canónico del sistema de diseño (DESIGN.md §4).
// Variantes y tamaños definidos en el golden book — no inventar nuevos sin actualizar el doc.

const VARIANTS = {
  primary:
    'bg-power hover:bg-yellow-300 text-black font-bold rounded-full ' +
    'focus-visible:ring-power/70',
  secondary:
    'bg-terminal-border/10 hover:bg-terminal-border/20 text-blue-100 ' +
    'border border-terminal-border/50 font-mono rounded-lg ' +
    'focus-visible:ring-terminal-border/70',
  ghost:
    'bg-transparent hover:bg-white/10 text-white border border-white/20 ' +
    'rounded-lg focus-visible:ring-white/40',
  icon:
    'bg-white/10 hover:bg-white/20 text-white backdrop-blur ' +
    'rounded-full grid place-items-center ' +
    'focus-visible:ring-white/40',
  danger:
    'bg-feedback-error/90 hover:bg-feedback-error text-white rounded-lg ' +
    'focus-visible:ring-feedback-error/70',
  toggle:
    'bg-white/[0.12] hover:bg-white/[0.28] text-white rounded-full ' +
    'backdrop-blur grid place-items-center ' +
    'focus-visible:ring-white/40',
  // Terminal-cyberpunk CTA filled (usado en GameOverModal, TutorialModal,
  // PreloaderContent). Square corners + mono + box-glow + text-shadow:none.
  'terminal-action':
    'bg-blue-500 text-black font-mono font-bold ' +
    'border-2 border-blue-400 rounded ' +
    'hover:bg-blue-400 active:scale-95 ' +
    '[text-shadow:none] shadow-[0_0_20px_rgba(59,130,246,0.4)] ' +
    'focus-visible:ring-blue-400/70',
  // Terminal-cyberpunk outline (secondary/exit/skip). Mismo lenguaje que
  // terminal-action pero sin fill.
  'terminal-outline':
    'bg-transparent text-blue-500 font-mono ' +
    'border border-blue-700 rounded ' +
    'hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 ' +
    'focus-visible:ring-blue-400/40',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-5 text-base',
  xl: 'h-[60px] px-6 text-lg',
};

// Tamaños específicos para terminal-* (text-sm fijo, altura compacta).
const TERMINAL_SIZES = {
  sm: 'h-9 px-5 text-sm',
  md: 'h-12 px-8 text-sm',
  lg: 'h-12 px-10 text-sm',
};

// Tamaños cuadrados para variantes `icon` / `toggle`
const ICON_SIZES = {
  sm: 'h-8 w-8 p-0',
  md: 'h-11 w-11 p-0',
  lg: 'h-12 w-12 p-0',
  xl: 'h-[60px] w-[60px] p-0',
};

const BASE =
  'inline-flex items-center justify-center gap-2 ' +
  'font-body select-none whitespace-nowrap ' +
  'transition-[transform,filter,box-shadow,background-color] duration-[120ms] ease-smooth-bounce ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ' +
  '[-webkit-tap-highlight-color:transparent]';

const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    type,
    className = '',
    children,
    ...rest
  },
  ref
) {
  const variantClasses = VARIANTS[variant] ?? VARIANTS.primary;
  const isTerminal = variant === 'terminal-action' || variant === 'terminal-outline';
  const sizeClasses = isTerminal
    ? TERMINAL_SIZES[size] ?? TERMINAL_SIZES.md
    : iconOnly || variant === 'icon' || variant === 'toggle'
      ? ICON_SIZES[size] ?? ICON_SIZES.md
      : SIZES[size] ?? SIZES.md;

  const resolvedType =
    Component === 'button' ? type ?? 'button' : type;

  return (
    <Component
      ref={ref}
      type={resolvedType}
      className={`${BASE} ${variantClasses} ${sizeClasses} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default Button;
