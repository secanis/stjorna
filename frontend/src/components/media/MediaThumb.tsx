import { Show } from 'solid-js';
import { Video, FileText } from 'lucide-solid';
import { getMediaFileUrl } from '~/utils/mediaUrl';
import type { Media } from '~/types';

interface MediaThumbProps {
  media: Pick<Media, 'id' | 'file' | 'mime_type' | 'filename'>;
  thumb?: string;
  class?: string;
  iconClass?: string;
}

// Renders a fixed-aspect thumbnail for any media file: image → PB thumb,
// video → muted video preview with a play-icon overlay, anything else
// → the filename. Failure to load hides the element so the icon (or
// overlay) remains visible.
export default function MediaThumb(props: MediaThumbProps) {
  const isImage = () => !!props.media.mime_type?.startsWith('image/');
  const isVideo = () => !!props.media.mime_type?.startsWith('video/');

  return (
    <Show when={props.media.file} fallback={
      <div class={`bg-gray-700 flex items-center justify-center text-gray-400 ${props.class ?? 'w-full h-16'}`}>
        <FileText size={20} class={props.iconClass} />
      </div>
    }>
      <Show when={isImage()}>
        <img
          src={getMediaFileUrl(props.media.id, props.media.file!, props.thumb ? { thumb: props.thumb } : undefined)}
          alt={props.media.filename || ''}
          class={props.class ?? 'w-full h-16 object-cover'}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </Show>
      <Show when={!isImage() && isVideo()}>
        <div class={`relative ${props.class ?? 'w-full h-16'}`}>
          <video
            src={getMediaFileUrl(props.media.id, props.media.file!)}
            class={`w-full h-full object-cover ${props.class ?? ''}`}
            muted
            playsinline
            preload="metadata"
            onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
          />
          <Video size={18} class="absolute inset-0 m-auto text-white drop-shadow pointer-events-none" />
        </div>
      </Show>
      <Show when={!isImage() && !isVideo()}>
        <div class={`bg-gray-700 flex items-center justify-center text-xs text-gray-400 p-1 truncate ${props.class ?? 'w-full h-16'}`}>
          {props.media.filename}
        </div>
      </Show>
    </Show>
  );
}