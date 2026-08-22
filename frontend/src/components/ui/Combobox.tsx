import { createSignal, createMemo, For, Show, onMount, onCleanup, JSX } from 'solid-js';
import { ChevronDown, X } from 'lucide-solid';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  allowClear?: boolean;
  clearLabel?: string;
  // Optional render for option text. Defaults to the label as-is. Use this
  // to highlight the matched substring: split label into <mark> spans.
  renderOption?: (label: string, query: string) => JSX.Element;
  class?: string;
  id?: string;
  testId?: string;
}

const defaultHighlight = (label: string, query: string): JSX.Element => {
  if (!query) return label;
  const lower = label.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark class="bg-yellow-500/40 text-gray-900 dark:text-white rounded px-0.5">
        {label.slice(idx, idx + query.length)}
      </mark>
      {label.slice(idx + query.length)}
    </>
  );
};

export default function Combobox(props: ComboboxProps) {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  const [activeIdx, setActiveIdx] = createSignal(0);
  let rootRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // If the selected value is cleared (e.g. form reset), also clear the
  // text in the input. When the user picks an option, we set both.
  const selectedLabel = () =>
    props.options.find((o) => o.value === props.value)?.label ?? '';

  const showClear = () => props.allowClear !== false && !!props.value;

  const items = createMemo<ComboboxOption[]>(() => {
    const q = query().trim().toLowerCase();
    if (!q) return props.options;
    return props.options.filter((o) => o.label.toLowerCase().includes(q));
  });

  const allItems = (): ComboboxOption[] => {
    const out: ComboboxOption[] = [];
    if (props.allowClear !== false) {
      out.push({ value: '', label: props.clearLabel ?? '— None —' });
    }
    out.push(...items());
    return out;
  };

  const focusInput = () => {
    setTimeout(() => inputRef?.focus(), 0);
  };

  const openDropdown = () => {
    if (open()) return;
    setOpen(true);
    setActiveIdx(0);
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
  };

  const pick = (val: string) => {
    props.onChange(val);
    closeDropdown();
    focusInput();
  };

  const onInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    setQuery(e.currentTarget.value);
    setActiveIdx(0);
    openDropdown();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open()) openDropdown();
      setActiveIdx((i) => Math.min(i + 1, allItems().length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open()) openDropdown();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (open() && allItems()[activeIdx()]) {
        e.preventDefault();
        pick(allItems()[activeIdx()].value);
      }
    } else if (e.key === 'Escape') {
      if (open()) {
        e.preventDefault();
        closeDropdown();
      }
    }
  };

  const onFocus = () => {
    // Don't auto-open on focus; only on input. This keeps the UX less
    // jumpy. ArrowDown opens it explicitly.
  };

  const onDocumentClick = (e: MouseEvent) => {
    if (!rootRef) return;
    if (!rootRef.contains(e.target as Node)) closeDropdown();
  };

  onMount(() => {
    document.addEventListener('mousedown', onDocumentClick);
  });
  onCleanup(() => {
    document.removeEventListener('mousedown', onDocumentClick);
  });

  const renderOption = props.renderOption ?? defaultHighlight;

  return (
    <div ref={rootRef} class={`relative ${props.class ?? ''}`}>
      <div class="relative">
        <input
          ref={inputRef}
          id={props.id}
          data-testid={props.testId}
          type="text"
          autocomplete="off"
          spellcheck={false}
          placeholder={props.placeholder ?? 'Type to search…'}
          value={open() ? query() : (query() || selectedLabel())}
          onInput={onInput}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onClick={openDropdown}
          class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded pl-3 pr-16 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
        />
        <div class="absolute inset-y-0 right-1 flex items-center gap-1">
          <Show when={showClear()}>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); pick(''); }}
              class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white p-1"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>
          </Show>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); open() ? closeDropdown() : openDropdown(); focusInput(); }}
            class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white p-1"
            aria-label="Toggle options"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <Show when={open()}>
        <ul
          class="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg"
          role="listbox"
        >
          <Show
            when={allItems().length > 0}
            fallback={
              <li class="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm">
                {props.emptyMessage ?? 'No matches'}
              </li>
            }
          >
            <For each={allItems()}>
              {(opt, i) => (
                <li
                  role="option"
                  aria-selected={props.value === opt.value}
                  data-testid={props.testId ? `${props.testId}-option-${opt.value || 'none'}` : undefined}
                  classList={{
                    'px-3 py-2 cursor-pointer text-sm': true,
                    'bg-blue-600 text-gray-900 dark:text-white': i() === activeIdx(),
                    'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700': i() !== activeIdx(),
                    'font-medium': props.value === opt.value && opt.value !== '',
                  }}
                  onMouseDown={(e) => { e.preventDefault(); pick(opt.value); }}
                  onMouseEnter={() => setActiveIdx(i())}
                >
                  {opt.value === '' ? opt.label : renderOption(opt.label, query())}
                </li>
              )}
            </For>
          </Show>
        </ul>
      </Show>
    </div>
  );
}