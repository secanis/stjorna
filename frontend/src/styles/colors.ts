/*
 * STJÓRNA Design System — Color Tokens (TypeScript mirror)
 * =========================================================
 * See colors.css for the full documentation. The two files are
 * kept in lockstep — when you change one, change the other.
 *
 * The strings here are Tailwind utility classes (the same ones you'd
 * type in a className). They are exported as plain strings so callers
 * can compose them:
 *
 *   <span class={`px-2 py-1 rounded ${ENTITY_TYPE_COLORS[event.type]}`}>
 */

import type { ActivityType, ActivityAction } from '~/utils/activity';

// ─────────────────────────────────────────────
// Entity colors
// Used in:
//   - Activity stream Type badge
//   - Quick Actions "Add <Entity>" button on Dashboard
//   - "+ Add <Entity>" button on the entity list page
// ─────────────────────────────────────────────
export const ENTITY_TYPE_COLORS: Record<ActivityType, string> = {
  tenant:   'bg-orange-600',
  user:     'bg-cyan-600',
  product:  'bg-emerald-600',
  media:    'bg-blue-600',
  category: 'bg-purple-600',
};

export const ENTITY_TYPE_HOVER_COLORS: Record<ActivityType, string> = {
  tenant:   'hover:bg-orange-700',
  user:     'hover:bg-cyan-700',
  product:  'hover:bg-emerald-700',
  media:    'hover:bg-blue-700',
  category: 'hover:bg-purple-700',
};

// Composite class strings for the standard "Add" button styling.
// `text-white` is baked in: every entity-color background (orange-600,
// cyan-600, emerald-600, blue-600, purple-600) needs bright text on it,
// and the only consistent value across both light and dark mode is
// pure white. Callers no longer need to add `text-white` themselves.
export const ENTITY_TYPE_BUTTON_CLASSES: Record<ActivityType, string> = {
  tenant:   'bg-orange-600 hover:bg-orange-700 text-white',
  user:     'bg-cyan-600 hover:bg-cyan-700 text-white',
  product:  'bg-emerald-600 hover:bg-emerald-700 text-white',
  media:    'bg-blue-600 hover:bg-blue-700 text-white',
  category: 'bg-purple-600 hover:bg-purple-700 text-white',
};

// Tailwind `text-` variants of the entity colors. Used for SVG icons
// (lucide) and other elements that inherit `currentColor` rather than
// using a background fill.
export const ENTITY_TYPE_TEXT_COLORS: Record<ActivityType, string> = {
  tenant:   'text-orange-600',
  user:     'text-cyan-600',
  product:  'text-emerald-600',
  media:    'text-blue-600',
  category: 'text-purple-600',
};

export const ENTITY_TYPE_LABELS: Record<ActivityType, string> = {
  tenant:   'Tenant',
  user:     'User',
  product:  'Product',
  media:    'Media',
  category: 'Category',
};

// ─────────────────────────────────────────────
// Brand primary button
// Used in: Save / Submit / generic CTAs across all admin and edit
// pages (Settings, TenantSettings, UserManagement, InstanceSettings,
// Setup, Login, and the three edit forms).
// Entity-specific "Add <Entity>" buttons use ENTITY_TYPE_BUTTON_CLASSES.
// ─────────────────────────────────────────────
export const PRIMARY_BUTTON_CLASSES = 'bg-blue-600 hover:bg-blue-700';

// ─────────────────────────────────────────────
// Activity-action colors
// Used in: Activity stream Action badge
// ─────────────────────────────────────────────
export const ACTION_COLORS: Record<ActivityAction, { bg: string; text: string }> = {
  // Light mode:  pale solid tint (e.g. green-100) + darker text
  //              (green-700). Pale text on pale bg was unreadable.
  // Dark mode:   same dim tint as before (color/20 on dark gray-800)
  //              + light text (color-300).
  created: { bg: 'bg-green-100 dark:bg-green-500/20',  text: 'text-green-700 dark:text-green-300'  },
  updated: { bg: 'bg-blue-100 dark:bg-blue-500/20',    text: 'text-blue-700 dark:text-blue-300'    },
  deleted: { bg: 'bg-red-100 dark:bg-red-500/20',      text: 'text-red-700 dark:text-red-300'      },
};

export const ACTION_LABELS: Record<ActivityAction, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
};
