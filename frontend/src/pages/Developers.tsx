import { createSignal, Show } from 'solid-js';
import { BookOpen, Check, Copy, Globe, KeyRound, Link2 } from 'lucide-solid';
import { i18nStore } from '~/i18n';
import { getConfiguredPbUrl } from '~/services/config';

// In-app "Developers" guide — how to integrate STJÓRNA media and catalog
// data into an external website. Mirrors the docs site page
// (site/src/content/docs/docs/embedding-media.md), with the tenant's real
// base URL pre-filled and the two flows side by side.

function CodeBlock(props: { code: string }) {
    const [copied, setCopied] = createSignal(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(props.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // best-effort
        }
    };
    return (
        <div class="relative group">
            <pre class="bg-gray-900 dark:bg-black text-gray-100 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap">{props.code}</pre>
            <button
                type="button"
                onClick={copy}
                class="absolute top-2 right-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                title={i18nStore.t('common.copy')}
            >
                <Show when={copied()} fallback={<Copy size={13} />}>
                    <Check size={13} class="text-green-400" />
                </Show>
            </button>
        </div>
    );
}

export default function Developers() {
    const baseUrl = () => {
        const configured = getConfiguredPbUrl();
        if (configured) return configured;
        return typeof window !== 'undefined' ? window.location.origin : '';
    };

    const exchangeCmd = () =>
        `# 1. Exchange an API key for a short-lived JWT (1 h)
curl -X POST ${baseUrl()}/api/stjorna/api-keys/exchange \\
  -H "Authorization: Bearer stjorna_<tenant>_<key>.<secret>"`;

    const productsCmd = () =>
        `# 2. Read products with their media (JWT from step 1)
curl "${baseUrl()}/api/collections/products/records?expand=media" \\
  -H "Authorization: <jwt>"`;

    const jsSnippet = () =>
        `import PocketBase from 'pocketbase';

const pb = new PocketBase('${baseUrl()}');
pb.authStore.save(jwt, null); // JWT from the exchange

const products = await pb.collection('products').getList(1, 50, { expand: 'media' });
const fileToken = await pb.files.getToken(); // POST /api/files/token

const src = pb.files.getURL(media, media.file, { thumb: '300x300', token: fileToken });`;

    const publicUrl = () =>
        `${baseUrl()}/api/stjorna/media/<media-id>/file?thumb=300x300`;

    return (
        <div class="max-w-4xl mx-auto p-6 space-y-6">
            <div class="flex items-center gap-3">
                <Globe size={28} class="text-blue-600 dark:text-blue-400" />
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('developers.title')}</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{i18nStore.t('developers.intro')}</p>
                </div>
            </div>

            {/* Base URL */}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    <Link2 size={18} /> {i18nStore.t('developers.baseUrl')}
                </h2>
                <code class="text-sm text-gray-700 dark:text-gray-300">{baseUrl()}</code>
            </div>

            {/* Storefront */}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
                <div>
                    <h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                        <KeyRound size={18} /> {i18nStore.t('developers.storefront')}
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{i18nStore.t('developers.storefrontHint')}</p>
                </div>

                <CodeBlock code={exchangeCmd()} />
                <CodeBlock code={productsCmd()} />
                <CodeBlock code={jsSnippet()} />
            </div>

            {/* Public embed */}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
                <div>
                    <h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                        <Globe size={18} /> {i18nStore.t('developers.publicEmbed')}
                    </h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">{i18nStore.t('developers.publicEmbedHint')}</p>
                </div>

                <CodeBlock code={publicUrl()} />
            </div>

            {/* Links */}
            <div class="flex flex-wrap gap-3">
                <a
                    href="https://stjorna.secanis.ch/docs/embedding-media/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                    <BookOpen size={16} /> {i18nStore.t('developers.docs')}
                </a>
                <a
                    href="https://github.com/secanis/stjorna/tree/main/demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                    <Globe size={16} /> {i18nStore.t('developers.demo')}
                </a>
            </div>
        </div>
    );
}
