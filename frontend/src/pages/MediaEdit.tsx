import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { getMediaFileUrl } from '~/utils/mediaUrl';
import { Upload, X, AlertTriangle } from 'lucide-solid';
import type { Media } from '~/types';

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
    s3_key: '',
    s3_url: '',
    thumbnail_url: '',
  });

  const [pendingFile, setPendingFile] = createSignal<File | null>(null);
  const [previewUrl, setPreviewUrl] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [imageError, setImageError] = createSignal<string | null>(null);
  const [loadError, setLoadError] = createSignal<string | null>(null);

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
        const baseUrl = import.meta.env.VITE_PB_URL || 'http://localhost:8090';
        // Backfill URLs for records created before the URL fix. The actual
        // access at display time uses getMediaFileUrl which adds the auth token.
        const canonicalFileUrl = record.file
          ? `${baseUrl}/api/files/media/${record.id}/${record.file}`
          : '';
        const canonicalThumbUrl = canonicalFileUrl
          ? `${canonicalFileUrl}?thumb=200x200`
          : '';
        setFormData({
          file: record.file || '',
          filename: record.filename || '',
          original_name: record.original_name || '',
          mime_type: record.mime_type || '',
          size: record.size || 0,
          s3_key: record.s3_key || '',
          s3_url: record.s3_url || canonicalFileUrl,
          thumbnail_url: record.thumbnail_url || canonicalThumbUrl,
        });
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

  // After a file is uploaded (create or update), populate s3_url and
  // thumbnail_url with the canonical PB file URLs so the form has the
  // right values immediately. The actual access at display time uses
  // getMediaFileUrl which adds the auth token.
  const setCanonicalUrls = async (recordId: string, filename: string) => {
    const baseUrl = import.meta.env.VITE_PB_URL || 'http://localhost:8090';
    const fileUrl = `${baseUrl}/api/files/media/${recordId}/${filename}`;
    const thumbUrl = `${fileUrl}?thumb=200x200`;
    await pb.collection('media').update(recordId, {
      s3_url: fileUrl,
      thumbnail_url: thumbUrl,
    });
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
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
        await setCanonicalUrls(created.id, created.file);
        sidebarStore.bump();
        navigate(`/media/${created.id}`);
        return;
      } else {
        const updateData: any = {
          filename: formData().filename,
          original_name: formData().original_name,
          s3_url: formData().s3_url,
          thumbnail_url: formData().thumbnail_url,
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
          const updated = await pb.collection('media').update(params.id!, form);
          // Re-set URLs based on the actual filename PB assigned (which may
          // differ from the original filename if PB normalises it).
          await setCanonicalUrls(updated.id, updated.file);
        } else {
          await pb.collection('media').update(params.id!, updateData);
        }
        sidebarStore.bump();
        setSuccess(true);
        setTimeout(() => navigate('/media'), 800);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center gap-4">
        <button onClick={() => navigate('/media')} class="text-gray-400 hover:text-white">
          ← Back
        </button>
        <h1 class="text-2xl font-bold text-white">
          {isEditing() ? 'Edit Media' : 'Upload Media'}
        </h1>
      </div>

      <Show when={loading()}>
        <div class="text-gray-400">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-400 text-sm">
          Media saved successfully!
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSubmit} class="space-y-6">
          <div class="bg-gray-800 rounded-lg p-6">
            <Show when={showRecordMissingPlaceholder()}>
              <div class="border-2 border-red-500/50 rounded-lg p-6 bg-red-500/5">
                <div class="flex items-start gap-3">
                  <AlertTriangle size={24} class="text-red-400 shrink-0 mt-1" />
                  <div>
                    <h3 class="text-white font-semibold mb-1">Media record not found</h3>
                    <p class="text-gray-300 text-sm mb-2">
                      Record ID: <code class="text-red-300">{params.id}</code>
                    </p>
                    <p class="text-gray-400 text-sm">
                      {loadError()}
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={showMissingFilePlaceholder()}>
              <div class="border-2 border-yellow-500/50 rounded-lg p-6 bg-yellow-500/5">
                <div class="flex items-start gap-3">
                  <AlertTriangle size={24} class="text-yellow-400 shrink-0 mt-1" />
                  <div>
                    <h3 class="text-white font-semibold mb-1">File missing</h3>
                    <p class="text-gray-300 text-sm mb-3">
                      This media record exists but has no file attached (the <code class="text-yellow-300">file</code> field is empty).
                      This can happen if the file was deleted on the server, or if the record was created without uploading a file.
                    </p>
                    <p class="text-gray-400 text-sm">
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
                    class="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded"
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
                  <AlertTriangle size={20} class="text-red-400 shrink-0 mt-0.5" />
                  <div class="flex-1 min-w-0">
                    <h4 class="text-white font-medium text-sm mb-1">Image failed to load</h4>
                    <p class="text-red-300 text-xs break-all">{imageError()}</p>
                  </div>
                </div>
              </div>
            </Show>

            <div class="mt-4">
              <label
                for="media-file"
                class={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                  dragOver() ? 'border-blue-500 bg-gray-700' : 'border-gray-600 hover:border-gray-500'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <Upload size={32} class="text-gray-400 mb-2" />
                <p class="text-white text-sm font-medium mb-1">
                  {pendingFile() ? 'Drop another file to replace' : (isNew() ? 'Drop file here or click to browse' : 'Drop new file to replace')}
                </p>
                <p class="text-gray-400 text-xs">JPEG, PNG, WebP, GIF, MP4, WebM — max 10MB</p>
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

          <div class="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 class="text-lg font-semibold text-white">Details</h2>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1" for="media-filename">Filename</label>
                <input
                  id="media-filename"
                  type="text"
                  value={formData().filename}
                  onInput={(e) => setFormData(d => ({ ...d, filename: e.currentTarget.value }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1" for="media-original-name">
                  Original Name
                  <span class="ml-2 text-xs text-gray-500">(set on upload, not editable)</span>
                </label>
                <input
                  id="media-original-name"
                  type="text"
                  value={formData().original_name}
                  readOnly
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white opacity-70 cursor-not-allowed"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1" for="media-mime">MIME Type</label>
                <input
                  id="media-mime"
                  type="text"
                  value={formData().mime_type}
                  onInput={(e) => setFormData(d => ({ ...d, mime_type: e.currentTarget.value }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1" for="media-size">Size (bytes)</label>
                <input
                  id="media-size"
                  type="number"
                  value={formData().size}
                  onInput={(e) => setFormData(d => ({ ...d, size: parseInt(e.currentTarget.value) || 0 }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1" for="media-s3-url">S3 URL</label>
              <input
                id="media-s3-url"
                type="url"
                value={formData().s3_url}
                onInput={(e) => setFormData(d => ({ ...d, s3_url: e.currentTarget.value }))}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="https://s3..."
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1" for="media-thumb-url">Thumbnail URL</label>
              <input
                id="media-thumb-url"
                type="url"
                value={formData().thumbnail_url}
                onInput={(e) => setFormData(d => ({ ...d, thumbnail_url: e.currentTarget.value }))}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="https://..."
              />
            </div>
          </div>

          <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-lg font-semibold text-white mb-2">Image Editing</h2>
            <p class="text-gray-400 text-sm mb-3">
              Crop and shape tools coming soon. Planned features:
            </p>
            <div class="flex flex-wrap gap-2">
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Free crop</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Square (1:1)</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Landscape (16:9)</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Landscape (4:3)</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Portrait (9:16)</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Portrait (3:4)</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Resize</span>
              <span class="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">Rotate</span>
            </div>
          </div>

          <div class="flex gap-3">
            <button
              type="submit"
              disabled={saving() || (isNew() && !pendingFile())}
              class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded disabled:opacity-50"
            >
              {saving() ? 'Saving...' : isNew() ? 'Upload' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/media')}
              class="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
}
