import { createSignal, createMemo, Show, type Accessor } from 'solid-js';
import { ImageCropper } from '@ark-ui/solid';
import type { Api } from '@zag-js/image-cropper';
import {
  Crop,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Maximize,
  Check,
  X,
} from 'lucide-solid';
import clsx from 'clsx';

interface AspectRatioOption {
  label: string;
  value: number | undefined;
}

const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
  { label: '3:4', value: 3 / 4 },
];

export interface ImageCropperProps {
  src: string;
  filename: string;
  mimeType?: string;
  onApply: (blob: Blob) => void | Promise<void>;
  onCancel: () => void;
  onReadyChange?: (ready: boolean) => void;
}

export default function ImageCropperComponent(props: ImageCropperProps) {
  const [aspectRatio, setAspectRatio] = createSignal<number | undefined>(undefined);
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [imageError, setImageError] = createSignal<string | null>(null);
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [processingError, setProcessingError] = createSignal<string | null>(null);

  const toolbarDisabled = createMemo(() => isProcessing() || !imageLoaded());

  const handleLoad = () => {
    setImageLoaded(true);
    setImageError(null);
    props.onReadyChange?.(true);
  };

  const handleError = () => {
    setImageLoaded(false);
    setImageError('Failed to load image for cropping.');
    props.onReadyChange?.(false);
  };

  const handleApply = async (api: Accessor<Api>) => {
    setProcessingError(null);
    setIsProcessing(true);
    try {
      const result = await api().getCroppedImage({
        type: props.mimeType || 'image/png',
        output: 'blob',
      });
      if (!result || typeof result === 'string') {
        setProcessingError('Could not generate cropped image.');
        return;
      }
      await props.onApply(result);
    } catch (e: any) {
      setProcessingError(e.message || 'Cropping failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const buttonClass = (active?: boolean) =>
    clsx(
      'px-2 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5',
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
    );

  const iconButtonClass =
    'p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <ImageCropper.Root
      aspectRatio={aspectRatio()}
      class="flex flex-col h-full"
      onCropChange={() => setProcessingError(null)}
    >
      <div class="flex-1 min-h-0 bg-gray-900 rounded-t-lg overflow-hidden relative">
        <ImageCropper.Viewport class="w-full h-full flex items-center justify-center">
          <ImageCropper.Image
            src={props.src}
            alt={props.filename}
            crossOrigin="anonymous"
            class="max-w-full max-h-full"
            onLoad={handleLoad}
            onError={handleError}
          />
          <ImageCropper.Selection class="border-2 border-dashed border-white/90 shadow-lg">
            <ImageCropper.Grid axis="x" class="border-white/40" />
            <ImageCropper.Grid axis="y" class="border-white/40" />
            <ImageCropper.Handle position="nw" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="n" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="ne" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="e" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="se" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="s" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="sw" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
            <ImageCropper.Handle position="w" class="w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow" />
          </ImageCropper.Selection>
        </ImageCropper.Viewport>

        <Show when={!imageLoaded() && !imageError()}>
          <div class="absolute inset-0 flex items-center justify-center bg-gray-900/50 text-white">
            Loading image…
          </div>
        </Show>

        <Show when={imageError()}>
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white p-6 text-center">
            <p class="text-red-300 mb-2">{imageError()}</p>
            <button
              type="button"
              onClick={props.onCancel}
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Close
            </button>
          </div>
        </Show>
      </div>

      <ImageCropper.Context>
        {(api) => (
          <div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg p-4 space-y-4">
            <Show when={processingError()}>
              <div class="bg-red-500/10 border border-red-500 rounded p-3 text-red-600 dark:text-red-400 text-sm">
                {processingError()}
              </div>
            </Show>

            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm text-gray-500 dark:text-gray-400 mr-1">Aspect</span>
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  type="button"
                  onClick={() => setAspectRatio(ratio.value)}
                  disabled={toolbarDisabled()}
                  class={buttonClass(aspectRatio() === ratio.value)}
                >
                  {ratio.label}
                </button>
              ))}
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => api().rotateBy(-90)}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Rotate left"
              >
                <RotateCcw size={18} />
              </button>
              <button
                type="button"
                onClick={() => api().rotateBy(90)}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Rotate right"
              >
                <RotateCw size={18} />
              </button>
              <button
                type="button"
                onClick={() => api().flipHorizontally()}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Flip horizontal"
              >
                <FlipHorizontal size={18} />
              </button>
              <button
                type="button"
                onClick={() => api().flipVertically()}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Flip vertical"
              >
                <FlipVertical size={18} />
              </button>
              <button
                type="button"
                onClick={() => api().zoomBy(-0.1)}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={() => api().zoomBy(0.1)}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={() => api().reset()}
                disabled={toolbarDisabled()}
                class={iconButtonClass}
                title="Reset"
              >
                <Maximize size={18} />
              </button>
            </div>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={props.onCancel}
                disabled={isProcessing()}
                class="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <X size={18} class="inline mr-1" />
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApply(api)}
                disabled={toolbarDisabled()}
                class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Show when={isProcessing()} fallback={<Crop size={18} />}>
                  <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </Show>
                {isProcessing() ? 'Applying…' : 'Apply Crop'}
                <Check size={18} />
              </button>
            </div>
          </div>
        )}
      </ImageCropper.Context>
    </ImageCropper.Root>
  );
}
