import { Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { i18nStore } from '~/i18n';

/**
 * Accessible replacement for window.confirm()/window.alert().
 *
 * Usage (anywhere, no context needed):
 *   if (!(await confirmDialog({ message: 'Delete this product?', danger: true }))) return;
 *   await alertDialog(`Failed to delete: ${e.message}`);
 *
 * <DialogHost /> must be mounted once (index.tsx). The dialog is a
 * role="alertdialog" with aria-modal, labelled/described by its title
 * and message, traps Tab focus, closes on Escape (= cancel) and
 * restores focus to the previously focused element.
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive. */
  danger?: boolean;
}

interface DialogRequest extends Required<Omit<ConfirmOptions, 'danger'>> {
  danger: boolean;
  /** alert() style: a single OK button. */
  alertOnly: boolean;
  resolve: (ok: boolean) => void;
}

const [current, setCurrent] = createSignal<DialogRequest | null>(null);
const queue: DialogRequest[] = [];

function enqueue(req: DialogRequest) {
  if (current()) queue.push(req);
  else setCurrent(req);
}

function settle(ok: boolean) {
  const req = current();
  if (!req) return;
  setCurrent(queue.shift() ?? null);
  req.resolve(ok);
}

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise((resolve) =>
    enqueue({
      title: o.title ?? i18nStore.t('common.pleaseConfirm'),
      message: o.message,
      confirmLabel: o.confirmLabel ?? i18nStore.t('common.confirm'),
      cancelLabel: o.cancelLabel ?? i18nStore.t('common.cancel'),
      danger: o.danger ?? false,
      alertOnly: false,
      resolve,
    }),
  );
}

export function alertDialog(message: string, title = i18nStore.t('common.somethingWentWrong')): Promise<void> {
  return new Promise((resolve) =>
    enqueue({
      title,
      message,
      confirmLabel: i18nStore.t('common.ok'),
      cancelLabel: '',
      danger: false,
      alertOnly: true,
      resolve: () => resolve(),
    }),
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function DialogHost() {
  let panelRef: HTMLDivElement | undefined;
  let confirmRef: HTMLButtonElement | undefined;
  let cancelRef: HTMLButtonElement | undefined;

  createEffect(() => {
    const req = current();
    if (!req) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Destructive actions default to Cancel so a stray Enter is safe.
    queueMicrotask(() => ((req.danger && cancelRef) ? cancelRef : confirmRef)?.focus());
    onCleanup(() => {
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    });
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      settle(false);
      return;
    }
    if (e.key === 'Tab' && panelRef) {
      const els = Array.from(panelRef.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <Show when={current()} keyed>
      {(req) => (
        <Portal>
          <div
            class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) settle(false); }}
          >
            <div
              ref={panelRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-message"
              data-testid="confirm-dialog"
              onKeyDown={onKeyDown}
              class="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-5 space-y-4"
            >
              <h2 id="confirm-dialog-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                {req.title}
              </h2>
              <p id="confirm-dialog-message" class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line break-words">
                {req.message}
              </p>
              <div class="flex justify-end gap-2">
                <Show when={!req.alertOnly}>
                  <button
                    type="button"
                    ref={cancelRef}
                    data-testid="confirm-dialog-cancel"
                    onClick={() => settle(false)}
                    class="px-4 py-2 rounded text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {req.cancelLabel}
                  </button>
                </Show>
                <button
                  type="button"
                  ref={confirmRef}
                  data-testid="confirm-dialog-confirm"
                  onClick={() => settle(true)}
                  class={`px-4 py-2 rounded text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    req.danger ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500'
                  }`}
                >
                  {req.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </Show>
  );
}
