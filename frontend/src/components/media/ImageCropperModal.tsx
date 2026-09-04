import { Show, onCleanup, onMount } from 'solid-js';
import ImageCropper from './ImageCropper';

export interface ImageCropperModalProps {
  src: string;
  filename: string;
  mimeType?: string;
  open: boolean;
  onApply: (blob: Blob) => void | Promise<void>;
  onClose: () => void;
}

export default function ImageCropperModal(props: ImageCropperModalProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        onClick={props.onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Image cropper"
      >
        <div
          class="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
              Edit Image — {props.filename}
            </h2>
            <button
              type="button"
              onClick={props.onClose}
              class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
              aria-label="Close cropper"
            >
              ✕
            </button>
          </div>
          <div class="flex-1 min-h-0 p-4 overflow-hidden">
            <ImageCropper
              src={props.src}
              filename={props.filename}
              mimeType={props.mimeType}
              onApply={props.onApply}
              onCancel={props.onClose}
            />
          </div>
        </div>
      </div>
    </Show>
  );
}
