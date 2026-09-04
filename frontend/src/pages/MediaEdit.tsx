import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { getMediaFileUrl, getMediaFileUrlAbsolute } from '~/utils/mediaUrl';
import { Upload, X, AlertTriangle, Copy, Check, Scissors, Trash2, ExternalLink } from 'lucide-solid';
import { ImageCropperModal } from '~/components/media';
import type { Media, Product, Category } from '~/types';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

const MAX_FILE_BYTES = 524288000; // 500 MiB — matches pocketbase/setup.ts media.file.maxSize

export default function MediaEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = () => !!params.id;
  const isNew = () => !params.id;

  const [formData, setFormData] = createSignal({
    file: '',
    filename: '',
    original_name: '',
    mime_type: '',
    size: 0,
  });

  // Server-populated URL info (read-only display).
  const [fileUrl, setFileUrl] = createSignal('');
  const [thumbUrl, setThumbUrl] = createSignal('');

  const [pendingFile, setPendingFile] = createSignal<File | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [imageError, setImageError] = createSignal<string | null>(null);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal<'file' | 'thumb' | null>(null);
  const [cropperOpen, setCropperOpen] = createSignal(false);
  const [usedInProducts, setUsedInProducts] = createSignal<Product[]>([]);
  const [usedInCategories, setUsedInCategories] = createSignal<Category[]>([]);
  const [usageLoading, setUsageLoading] = createSignal(false);

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }
  });

  onMount(async () => {
    if (isEditing()) {
      try {
        const record = await pb.collection('media').getOne<Media>(params.id!);
        applyRecord(record);
      } catch (e: any) {
        setLoadError(`Record not found: ${e.status} ${e.message}`);
        setError(`Could not load media record ${params.id}`);
      }
    }
    setLoading(false);
  });

  onCleanup(() => {
    if (previewUrl()) {
      URL.revokeObjectURL(previewUrl()!);
    }
  });

  const setFile = (file: File) => {
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const limitMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
      setError(`File is ${sizeMb} MB — the maximum allowed size is ${limitMb} MB.`);
      return;
    }
    if (previewUrl()) {
      URL.revokeObjectURL(previewUrl()!);
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPendingFile(file);
    setImageError(null);
    setFormData(d => ({
      ...d,
      filename: d.filename || file.name,
      original_name: d.original_name || file.name,
      mime_type: d.mime_type || file.type,
      size: d.size || file.size,
    }));
    // Reset stale URL info — it will be re-populated after save.
    setFileUrl('');
    setThumbUrl('');
  };

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setFile(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    setFile(file);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const clearPendingFile = () => {
    if (previewUrl()) {
      URL.revokeObjectURL(previewUrl()!);
    }
    setPreviewUrl(null);
    setPendingFile(null);
    setImageError(null);
  };

  const resolvedUrl = () => {
    if (previewUrl()) return previewUrl()!;
    if (isEditing() && formData().file) {
      return getMediaFileUrl(params.id!, formData().file);
    }
    return null;
  };

  const isImage = () => {
    if (pendingFile()) return pendingFile()!.type.startsWith('image/');
    return formData().mime_type?.startsWith('image/');
  };

  const isVideo = () => {
    if (pendingFile()) return pendingFile()!.type.startsWith('video/');
    return formData().mime_type?.startsWith('video/');
  };

  const showImageElement = () => resolvedUrl() && (isImage() || isVideo());

  const showMissingFilePlaceholder = () =>
    isEditing() && !previewUrl() && !formData().file && !loadError();

  const showRecordMissingPlaceholder = () =>
    isEditing() && !!loadError();

  const applyRecord = (record: Media) => {
    setFormData({
      file: record.file || '',
      filename: record.filename || '',
      original_name: record.original_name || '',
      mime_type: record.mime_type || '',
      size: record.size || 0,
    });
    if (record.file) {
      setFileUrl(getMediaFileUrlAbsolute(record.id, record.file));
      setThumbUrl(getMediaFileUrlAbsolute(record.id, record.file, { thumb: '200x200' }));
    } else {
      setFileUrl('');
      setThumbUrl('');
    }
    fetchUsage(record.id);
  };

  const fetchUsage = async (mediaId: string) => {
    const tenant = getCurrentTenant();
    if (!tenant) return;
    setUsageLoading(true);
    try {
      const tenantFilter = `tenant = "${tenant}"`;
      const [products, categories] = await Promise.all([
        pb.collection('products').getList<Product>(1, 200, {
          filter: `${tenantFilter} && media ?~ "${mediaId}"`,
          sort: 'name',
        }),
        pb.collection('categories').getList<Category>(1, 200, {
          filter: `${tenantFilter} && media = "${mediaId}"`,
          sort: 'name',
        }),
      ]);
      setUsedInProducts(products.items);
      setUsedInCategories(categories.items);
    } catch (e: any) {
      // Best-effort: usage data is non-critical.
      setUsedInProducts([]);
      setUsedInCategories([]);
    } finally {
      setUsageLoading(false);
    }
  };

  const copyUrl = async (kind: 'file' | 'thumb') => {
    const url = kind === 'file' ? fileUrl() : thumbUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      setTimeout(() => setCopied(c => (c === kind ? null : c)), 1500);
    } catch {
      // best-effort: clipboard may be denied
    }
  };

  const saveRecord = async (options?: { redirect?: boolean }) => {
    const redirect = options?.redirect !== false;
    setError('');

    const tenant = getCurrentTenant();
    if (!tenant) {
      setError('No tenant selected');
      return;
    }

    setSaving(true);

    try {
      if (isNew()) {
        if (!pendingFile()) {
          setError('Please select a file to upload');
          setSaving(false);
          return;
        }

        const form = new FormData();
        form.append('file', pendingFile()!);
        form.append('filename', formData().filename || pendingFile()!.name);
        form.append('original_name', formData().original_name || pendingFile()!.name);
        form.append('mime_type', formData().mime_type || pendingFile()!.type);
        form.append('size', String(formData().size || pendingFile()!.size));
        form.append('tenant', tenant);

        const created = await pb.collection('media').create(form);
        sidebarStore.bump();
        navigate(`/media/${created.id}`);
        return;
      } else {
        const updateData: any = {
          filename: formData().filename,
          original_name: formData().original_name,
          tenant,
        };

        if (pendingFile()) {
          const form = new FormData();
          form.append('file', pendingFile()!);
          Object.entries(updateData).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              form.append(key, String(value));
            }
          });
          const updated = await pb.collection('media').update<Media>(params.id!, form);
          applyRecord(updated);
        } else {
          const updated = await pb.collection('media').update<Media>(params.id!, updateData);
          applyRecord(updated);
        }
        sidebarStore.bump();
        setSuccess(true);
        if (redirect) {
          setTimeout(() => navigate('/media'), 800);
        }
      }
    } catch (e: any) {
      setError(describeApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await saveRecord();
  };

  const handleCropApply = async (blob: Blob) => {
    const filename = formData().filename || formData().original_name || 'cropped.png';
    // Change the stored filename on every crop so PocketBase treats it as a new
    // file and regenerates thumbnails instead of serving cached ones.
    const lastDot = filename.lastIndexOf('.');
    const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.slice(lastDot) : '.png';
    const uniqueSuffix = Date.now();
    const croppedFilename = `${base}-cropped-${uniqueSuffix}${ext}`;
    const file = new File([blob], croppedFilename, { type: blob.type || formData().mime_type || 'image/png' });
    setCropperOpen(false);
    setFile(file);
  };

  const handleDelete = async () => {
    if (!isEditing()) return;
    const usedCount = usedInProducts().length + usedInCategories().length;
    const message = usedCount > 0
      ? `This media is used in ${usedInProducts().length} product(s) and ${usedInCategories().length} category(ies). Delete anyway?`
      : 'Delete this media item?';
    if (!confirm(message)) return;
    try {
      await pb.collection('media').delete(params.id!);
      sidebarStore.bump();
      navigate('/media');
    } catch (e: any) {
      setError(describeApiError(e));
    }
  };

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center gap-4">
        <button onClick={() => navigate('/media')} class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white">
          ← Back
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {isEditing() ? 'Edit Media' : 'Upload Media'}
        </h1>
      </div>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-600 dark:text-green-400 text-sm">
          Media saved successfully!
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSubmit} class="space-y-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-6">
            <Show when={showRecordMissingPlaceholder()}>
              <div class="border-2 border-red-500/50 rounded-lg p-6 bg-red-500/5">
                <div class="flex items-start gap-3">
                  <AlertTriangle size={24} class="text-red-600 dark:text-red-400 shrink-0 mt-1" />
                  <div>
                    <h3 class="text-gray-900 dark:text-white font-semibold mb-1">Media record not found</h3>
                    <p class="text-gray-700 dark:text-gray-300 text-sm mb-2">
                      Record ID: <code class="text-red-700 dark:text-red-300">{params.id}</code>
                    </p>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">
                      {loadError()}
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={showMissingFilePlaceholder()}>
              <div class="border-2 border-yellow-500/50 rounded-lg p-6 bg-yellow-500/5">
                <div class="flex items-start gap-3">
                  <AlertTriangle size={24} class="text-yellow-600 dark:text-yellow-400 shrink-0 mt-1" />
                  <div>
                    <h3 class="text-gray-900 dark:text-white font-semibold mb-1">File missing</h3>
                    <p class="text-gray-700 dark:text-gray-300 text-sm mb-3">
                      This media record exists but has no file attached (the <code class="text-yellow-700 dark:text-yellow-300">file</code> field is empty).
                      This can happen if the file was deleted on the server, or if the record was created without uploading a file.
                    </p>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">
                      Drop a file below to upload a replacement.
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={showImageElement()}>
              <div class="relative">
                <Show when={isImage()}>
                  <img
                    src={resolvedUrl()!}
                    alt={formData().original_name || formData().filename}
                    class="max-h-96 mx-auto rounded"
                    onError={() => {
                      setImageError(`Failed to load image from: ${resolvedUrl()}`);
                    }}
                    onLoad={() => setImageError(null)}
                  />
                  <Show when={isEditing()}>
                    <button
                      type="button"
                      onClick={() => setCropperOpen(true)}
                      class="absolute top-2 left-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded shadow"
                      title="Edit image"
                    >
                      <Scissors size={18} />
                    </button>
                  </Show>
                </Show>
                <Show when={isVideo()}>
                  <video
                    src={resolvedUrl()!}
                    controls
                    class="max-h-96 mx-auto rounded"
                    onError={() => {
                      setImageError(`Failed to load video from: ${resolvedUrl()}`);
                    }}
                  />
                </Show>
                <Show when={pendingFile()}>
                  <button
                    type="button"
                    onClick={clearPendingFile}
                    class="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-gray-900 dark:text-white p-1.5 rounded"
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </Show>
              </div>
            </Show>

            <Show when={imageError()}>
              <div class="border-2 border-red-500/50 rounded-lg p-4 bg-red-500/5 mt-3">
                <div class="flex items-start gap-3">
                  <AlertTriangle size={20} class="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div class="flex-1 min-w-0">
                    <h4 class="text-gray-900 dark:text-white font-medium text-sm mb-1">Image failed to load</h4>
                    <p class="text-red-700 dark:text-red-300 text-xs break-all">{imageError()}</p>
                  </div>
                </div>
              </div>
            </Show>

            <div class="mt-4">
              <label
                for="media-file"
                class={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                  dragOver() ? 'border-blue-500 bg-gray-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload size={32} class="text-gray-500 dark:text-gray-400 mb-2" />
                <p class="text-gray-900 dark:text-white text-sm font-medium mb-1">
                  {pendingFile() ? 'Drop another file to replace' : (isNew() ? 'Drop file here or click to browse' : 'Drop new file to replace')}
                </p>
                <p class="text-gray-500 dark:text-gray-400 text-xs">JPEG, PNG, WebP, GIF, MP4, WebM — max 500 MB</p>
                <input
                  id="media-file"
                  type="file"
                  onChange={handleFileSelect}
                  class="hidden"
                  accept="image/*,video/*"
                />
              </label>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Details</h2>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="media-filename">Filename</label>
                <input
                  id="media-filename"
                  type="text"
                  value={formData().filename}
                  onInput={(e) => setFormData(d => ({ ...d, filename: e.currentTarget.value }))}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="media-original-name">
                  Original Name
                  <span class="ml-2 text-xs text-gray-600 dark:text-gray-500">(set on upload, not editable)</span>
                </label>
                <input
                  id="media-original-name"
                  type="text"
                  value={formData().original_name}
                  readOnly
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white opacity-70 cursor-not-allowed"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="media-mime">MIME Type</label>
                <input
                  id="media-mime"
                  type="text"
                  value={formData().mime_type}
                  onInput={(e) => setFormData(d => ({ ...d, mime_type: e.currentTarget.value }))}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="media-size">Size (bytes)</label>
                <input
                  id="media-size"
                  type="number"
                  value={formData().size}
                  onInput={(e) => setFormData(d => ({ ...d, size: parseInt(e.currentTarget.value) || 0 }))}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <Show when={fileUrl()}>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  File URL
                </label>
                <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2">
                  <code class="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate" title={fileUrl()}>{fileUrl()}</code>
                  <button
                    type="button"
                    onClick={() => copyUrl('file')}
                    class="shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
                    title="Copy URL"
                  >
                    <Show when={copied() === 'file'} fallback={<Copy size={14} />}>
                      <Check size={14} class="text-green-600 dark:text-green-400" />
                    </Show>
                  </button>
                </div>
              </div>
            </Show>

            <Show when={thumbUrl()}>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Thumbnail URL
                </label>
                <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-3 py-2">
                  <code class="flex-1 text-xs text-gray-700 dark:text-gray-300 truncate" title={thumbUrl()}>{thumbUrl()}</code>
                  <button
                    type="button"
                    onClick={() => copyUrl('thumb')}
                    class="shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white"
                    title="Copy URL"
                  >
                    <Show when={copied() === 'thumb'} fallback={<Copy size={14} />}>
                      <Check size={14} class="text-green-600 dark:text-green-400" />
                    </Show>
                  </button>
                </div>
              </div>
            </Show>
          </div>

          <Show when={isEditing()}>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Used In</h2>

              <Show when={usageLoading()}>
                <div class="text-gray-500 dark:text-gray-400 text-sm">Loading usage…</div>
              </Show>

              <Show when={!usageLoading() && usedInProducts().length === 0 && usedInCategories().length === 0}>
                <p class="text-gray-500 dark:text-gray-400 text-sm">This media is not used in any products or categories.</p>
              </Show>

              <Show when={!usageLoading() && usedInProducts().length > 0}>
                <div>
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Products</h3>
                  <ul class="space-y-1">
                    <For each={usedInProducts()}>
                      {(product) => (
                        <li>
                          <button
                            type="button"
                            onClick={() => navigate(`/products/${product.id}`)}
                            class="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                          >
                            <ExternalLink size={14} />
                            {product.name}
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </Show>

              <Show when={!usageLoading() && usedInCategories().length > 0}>
                <div>
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categories</h3>
                  <ul class="space-y-1">
                    <For each={usedInCategories()}>
                      {(category) => (
                        <li>
                          <button
                            type="button"
                            onClick={() => navigate(`/categories/${category.id}`)}
                            class="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                          >
                            <ExternalLink size={14} />
                            {category.name}
                          </button>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </Show>
            </div>
          </Show>

          <div class="flex gap-3">
            <button
              type="submit"
              disabled={saving() || (isNew() && !pendingFile())}
              class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-6 rounded disabled:opacity-50`}
            >
              {saving() ? 'Saving...' : isNew() ? 'Upload' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/media')}
              class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-6 rounded"
            >
              Cancel
            </button>
            <Show when={isEditing() && authStore.isEditorOrAbove()}>
              <button
                type="button"
                onClick={handleDelete}
                class="ml-auto bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded flex items-center gap-2"
              >
                <Trash2 size={18} />
                Delete
              </button>
            </Show>
          </div>
        </form>
      </Show>

      <ImageCropperModal
        src={isEditing() && formData().file ? getMediaFileUrl(params.id!, formData().file) : ''}
        filename={formData().filename || formData().original_name || 'image'}
        mimeType={formData().mime_type}
        open={cropperOpen()}
        onApply={handleCropApply}
        onClose={() => setCropperOpen(false)}
      />
    </div>
  );
}

function describeApiError(err: any): string {
  if (!err) return 'Failed to save';
  if (err.status === 0 || err.isAbort) {
    return 'Cannot reach PocketBase server.';
  }
  const msg = err.response?.message || err.message;
  return msg || `Failed to save (${err.status || 'unknown'})`;
}
