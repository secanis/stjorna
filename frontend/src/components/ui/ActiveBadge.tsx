/*
 * ActiveBadge — yes/no indicator (used as a toggle-button when onClick
 * is provided, or a passive pill otherwise).
 * =========================================================
 * Replaces the textual "Yes" / "No" Active flag on Category and
 * Product entities with a Checkmark / X icon plus a label, so the
 * state is scannable at a glance and stays readable in both light
 * and dark mode.
 *
 * Props:
 *   active      — boolean state to reflect. REQUIRED.
 *   onClick     — if present, the badge becomes a toggleable button.
 *                 If absent, the badge is a passive span.
 *   size        — "sm" (default) for list-page cells,
 *                  "md" for edit-page form fields.
 *   disabled    — disables the onClick handler + dims the badge.
 *   labelOff    — override the inactive label (default: "No")
 *   labelOn     — override the active label (default: "Yes")
 *   ariaLabel   — override the aria-label (default: "Active: Yes/No")
 */

import { JSX, Show } from 'solid-js';
import { Check, X } from 'lucide-solid';

export interface ActiveBadgeProps {
  active: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  labelOn?: string;
  labelOff?: string;
  ariaLabel?: string;
}

const ICON_SIZE = { sm: 12, md: 14 } as const;

export function ActiveBadge(props: ActiveBadgeProps): JSX.Element {
  const size = () => props.size ?? 'sm';
  const on = props.labelOn ?? 'Yes';
  const off = props.labelOff ?? 'No';
  // The shape is identical for button vs span — only the wrapper tag differs.
  // We split into two components so the disabled / aria behavior is right.
  if (props.onClick) {
    return (
      <button
        type="button"
        onClick={() => { if (!props.disabled) props.onClick!(); }}
        aria-pressed={props.active}
        aria-label={props.ariaLabel ?? `Active: ${props.active ? on : off}`}
        disabled={props.disabled}
        classList={{
          'inline-flex items-center gap-1 rounded font-medium transition-colors': true,
          'px-2 py-1 text-xs': size() === 'sm',
          'px-3 py-1 text-sm': size() === 'md',
          'bg-green-600 text-white hover:bg-green-700': props.active && !props.disabled,
          'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500': !props.active && !props.disabled,
          'opacity-50 cursor-not-allowed': !!props.disabled,
        }}
      >
        <Show when={props.active} fallback={<X size={ICON_SIZE[size()]} />}>
          <Check size={ICON_SIZE[size()]} />
        </Show>
        {props.active ? on : off}
      </button>
    );
  }
  return (
    <span
      role="status"
      aria-label={props.ariaLabel ?? `Active: ${props.active ? on : off}`}
      classList={{
        'inline-flex items-center gap-1 rounded font-medium': true,
        'px-2 py-1 text-xs': size() === 'sm',
        'px-3 py-1 text-sm': size() === 'md',
        'bg-green-600 text-white': props.active,
        'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300': !props.active,
      }}
    >
      <Show when={props.active} fallback={<X size={ICON_SIZE[size()]} />}>
        <Check size={ICON_SIZE[size()]} />
      </Show>
      {props.active ? on : off}
    </span>
  );
}

export default ActiveBadge;
