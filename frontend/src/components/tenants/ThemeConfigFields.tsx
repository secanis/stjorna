import { Show } from 'solid-js';

// Structured editor for a tenant's theme_config. Replaces the old raw-JSON
// textarea: syntax errors are impossible here, and unknown JSON keys are
// preserved by the caller (buildThemeConfig merges them back on save).
//
// Validation is intentionally light per the feature spec:
//   - logoMediaId: any non-empty string (media record ID; no existence check)
//   - colors: any CSS color string; the swatch gives instant visual feedback
//     (an invalid color simply doesn't paint the swatch)

export interface ThemeFields {
  logoMediaId: string;
  headerBgLight: string;
  headerBgDark: string;
}

interface Props {
  value: ThemeFields;
  onChange: (fields: ThemeFields) => void;
}

const INPUT_CLASSES =
  'w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500';

function ColorField(props: {
  label: string;
  value: string;
  placeholder: string;
  onInput: (v: string) => void;
}) {
  return (
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
      <div class="flex items-center gap-2">
        <input
          type="text"
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          class={`${INPUT_CLASSES} font-mono text-sm`}
          placeholder={props.placeholder}
        />
        <div
          class="w-9 h-9 rounded border border-gray-300 dark:border-gray-600 shrink-0"
          style={{ 'background-color': props.value.trim() || 'transparent' }}
          title={props.value.trim() ? props.value.trim() : 'default'}
        />
      </div>
      <Show when={props.value.trim()}>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Any CSS color works (#hex, rgb(), oklch(), named). If the swatch stays empty, the color is invalid and the default is used.
        </p>
      </Show>
    </div>
  );
}

export default function ThemeConfigFields(props: Props) {
  const set = (patch: Partial<ThemeFields>) => props.onChange({ ...props.value, ...patch });

  return (
    <fieldset class="border border-gray-200 dark:border-gray-700 rounded p-4 space-y-4">
      <legend class="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">Theme</legend>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo media ID</label>
        <input
          type="text"
          value={props.value.logoMediaId}
          onInput={(e) => set({ logoMediaId: e.currentTarget.value })}
          class={`${INPUT_CLASSES} font-mono text-sm`}
          placeholder="Media record ID, e.g. 7xk9m2p4q8r1s5t"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          ID of an uploaded media record, shown in the header instead of the "STJÓRNA" text. Empty = default text.
        </p>
      </div>

      <ColorField
        label="Header background (light mode)"
        value={props.value.headerBgLight}
        placeholder="#f9fafb (default)"
        onInput={(v) => set({ headerBgLight: v })}
      />

      <ColorField
        label="Header background (dark mode)"
        value={props.value.headerBgDark}
        placeholder="#111827 (default)"
        onInput={(v) => set({ headerBgDark: v })}
      />
    </fieldset>
  );
}
