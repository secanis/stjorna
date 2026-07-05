import { createSignal, createResource, Show, onMount } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import type { Media } from '~/types';

export default function MediaEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = () => !!params.id;

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

  const [formData, setFormData] = createSignal({
    filename: '',
    original_name: '',
    mime_type: '',
    size: 0,
    s3_key: '',
    s3_url: '',
    thumbnail_url: '',
  });
  const [uploading, setUploading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    if (isEditing()) {
      try {
        const record = await pb.collection('media').getOne<Media>(params.id!);
        setFormData({
          filename: record.filename || '',
          original_name: record.original_name || '',
          mime_type: record.mime_type || '',
          size: record.size || 0,
          s3_key: record.s3_key || '',
          s3_url: record.s3_url || '',
          thumbnail_url: record.thumbnail_url || '',
        });
      } catch (e: any) {
        setError(`Failed to load media: ${e.message}`);
      }
    }
  });

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tenant', getCurrentTenant() || '');

      const uploaded = await pb.collection('media').create(form);

      setFormData({
        filename: uploaded.filename,
        original_name: file.name,
        mime_type: uploaded.mime_type,
        size: uploaded.size,
        s3_key: '',
        s3_url: '',
        thumbnail_url: '',
      });
    } catch (e: any) {
      setError(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isEditing() && !formData().filename) {
      setError('Please upload a file first');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const tenant = getCurrentTenant();
      if (isEditing()) {
        await pb.collection('media').update(params.id!, {
          ...formData(),
          tenant,
        });
      }
      navigate('/media');
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-6 max-w-2xl">
      <div class="flex items-center gap-4">
        <button onClick={() => navigate('/media')} class="text-gray-400 hover:text-white">
          ← Back
        </button>
        <h1 class="text-2xl font-bold text-white">
          {isEditing() ? 'Edit Media' : 'Upload Media'}
        </h1>
      </div>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <form onSubmit={handleSubmit} class="space-y-6">
        <Show when={!isEditing()}>
          <div class="bg-gray-800 rounded-lg p-6">
            <label class="block text-sm font-medium text-gray-300 mb-2">Upload File</label>
            <input
              type="file"
              onChange={handleFileSelect}
              disabled={uploading()}
              class="w-full text-white"
              accept="image/*,video/*"
            />
            <Show when={uploading()}>
              <p class="text-blue-400 text-sm mt-2">Uploading...</p>
            </Show>
          </div>
        </Show>

        <Show when={formData().filename}>
          <Show when={formData().mime_type?.startsWith('image/')}>
            <div class="bg-gray-800 rounded-lg p-4">
              <img
                src={`${import.meta.env.VITE_PB_URL || 'http://localhost:8090'}/api/files/media/${isEditing() ? params.id : ''}${formData().filename}`}
                alt={formData().original_name || formData().filename}
                class="max-h-48 rounded"
              />
            </div>
          </Show>

          <div class="bg-gray-800 rounded-lg p-6 space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Filename</label>
                <input
                  type="text"
                  value={formData().filename}
                  onInput={(e) => setFormData(d => ({ ...d, filename: e.currentTarget.value }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Original Name</label>
                <input
                  type="text"
                  value={formData().original_name}
                  onInput={(e) => setFormData(d => ({ ...d, original_name: e.currentTarget.value }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">MIME Type</label>
                <input
                  type="text"
                  value={formData().mime_type}
                  onInput={(e) => setFormData(d => ({ ...d, mime_type: e.currentTarget.value }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Size (bytes)</label>
                <input
                  type="number"
                  value={formData().size}
                  onInput={(e) => setFormData(d => ({ ...d, size: parseInt(e.currentTarget.value) || 0 }))}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">S3 URL</label>
              <input
                type="url"
                value={formData().s3_url}
                onInput={(e) => setFormData(d => ({ ...d, s3_url: e.currentTarget.value }))}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="https://s3..."
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Thumbnail URL</label>
              <input
                type="url"
                value={formData().thumbnail_url}
                onInput={(e) => setFormData(d => ({ ...d, thumbnail_url: e.currentTarget.value }))}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="https://..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving()}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded disabled:opacity-50"
          >
            {saving() ? 'Saving...' : 'Save'}
          </button>
        </Show>
      </form>
    </div>
  );
}