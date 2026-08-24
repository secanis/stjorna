import { createSignal, onMount, Show } from 'solid-js';
import { Code, Globe, Hash, Calendar, Info } from 'lucide-solid';
import { authStore } from '~/stores/auth';

type VersionInfo = {
    version: string;
    commit: string;
    buildTime: string;
};

// Curated list of the project's main OSS dependencies. Showing every
// dep from package.json would be noise; this is the "what is STJÓRNA
// actually built on" view. Licenses are pulled from the package.json
// for accuracy when available, otherwise annotated from the source.
const DEPENDENCIES = [
    {
        name: 'PocketBase',
        description: 'Single-binary Go backend (auth, file storage, admin UI)',
        license: 'MIT',
        url: 'https://pocketbase.io',
        role: 'backend',
    },
    {
        name: 'SolidJS',
        description: 'Reactive UI framework with fine-grained reactivity',
        license: 'MIT',
        url: 'https://solidjs.com',
        role: 'frontend',
    },
    {
        name: 'Solid Router',
        description: '@solidjs/router — file-based routing for SolidJS',
        license: 'MIT',
        url: 'https://github.com/solidjs/solid-router',
        role: 'frontend',
    },
    {
        name: 'TanStack Query (Solid)',
        description: 'Async state management / caching',
        license: 'MIT',
        url: 'https://tanstack.com/query',
        role: 'frontend',
    },
    {
        name: 'lucide-solid',
        description: 'Icon library (SolidJS bindings for Lucide)',
        license: 'ISC',
        url: 'https://lucide.dev',
        role: 'frontend',
    },
    {
        name: 'Swagger UI',
        description: 'swagger-ui-dist — interactive OpenAPI docs',
        license: 'Apache-2.0',
        url: 'https://swagger.io/tools/swagger-ui/',
        role: 'frontend',
    },
    {
        name: 'Tailwind CSS',
        description: 'Utility-first CSS framework',
        license: 'MIT',
        url: 'https://tailwindcss.com',
        role: 'styling',
    },
    {
        name: 'TypeScript',
        description: 'Static type checker (source is .tsx)',
        license: 'Apache-2.0',
        url: 'https://www.typescriptlang.org',
        role: 'tooling',
    },
    {
        name: 'Vite',
        description: 'Frontend build tool / dev server',
        license: 'MIT',
        url: 'https://vitejs.dev',
        role: 'tooling',
    },
    {
        name: 'Playwright',
        description: 'End-to-end browser test runner',
        license: 'Apache-2.0',
        url: 'https://playwright.dev',
        role: 'tooling',
    },
    {
        name: 'Vitest',
        description: 'Unit-test runner (Vite-native)',
        license: 'MIT',
        url: 'https://vitest.dev',
        role: 'tooling',
    },
    {
        name: 'Helm + Garage',
        description: 'Helm chart packaging + optional S3-compatible object store (Deuxfleurs Garage)',
        license: 'Apache-2.0 (Helm) / MIT (Garage)',
        url: 'https://helm.sh',
        role: 'deployment',
    },
] as const;

const ROLE_LABEL: Record<string, string> = {
    backend: 'Backend',
    frontend: 'Frontend',
    styling: 'Styling',
    tooling: 'Tooling',
    deployment: 'Deployment',
};

function formatBuildTime(iso: string): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

export default function About() {
    const [versionInfo, setVersionInfo] = createSignal<VersionInfo | null>(null);
    const [loadError, setLoadError] = createSignal<string | null>(null);

    onMount(async () => {
        // /version.json is emitted by scripts/generate-version.mjs at build
        // time and ships under public/. Treat a 404 (e.g. older image
        // predating the script) as "unknown version" rather than a hard error.
        try {
            const res = await fetch('/version.json', { cache: 'no-cache' });
            if (!res.ok) {
                setLoadError(`version.json: HTTP ${res.status}`);
                return;
            }
            const data = await res.json();
            setVersionInfo({
                version: String(data.version ?? 'unknown'),
                commit: String(data.commit ?? 'unknown'),
                buildTime: String(data.buildTime ?? ''),
            });
        } catch (e: any) {
            setLoadError(e?.message || String(e));
        }
    });

    return (
        <div class="max-w-3xl mx-auto p-6 space-y-6">
            <div class="flex items-center gap-3">
                <Info size={28} class="text-blue-600 dark:text-blue-400" />
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">About STJÓRNA</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Multi-tenant product management with a read-only REST API.</p>
                </div>
            </div>

            <Show when={authStore.isAuthenticated()}>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    You are signed in as <code class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">{authStore.user?.email || 'unknown user'}</code>.
                </p>
            </Show>

            {/* Links */}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Project links</h2>
                <ul class="space-y-3">
                    <li>
                        <a href="https://github.com/secanis/stjorna" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                            <Code size={18} />
                            <span class="flex-1">
                                <span class="font-medium">Source code (GitHub)</span>
                                <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">github.com/secanis/stjorna</span>
                            </span>
                            <span class="text-gray-400">↗</span>
                        </a>
                    </li>
                    <li>
                        <a href="https://stjorna.secanis.ch" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:text-blue-400">
                            <Globe size={18} />
                            <span class="flex-1">
                                <span class="font-medium">Project website &amp; install docs</span>
                                <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">stjorna.secanis.ch</span>
                            </span>
                            <span class="text-gray-400">↗</span>
                        </a>
                    </li>
                </ul>
            </div>

            {/* Version */}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Version</h2>
                <Show
                    when={versionInfo()}
                    fallback={
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            <Show when={loadError()} fallback={<>Loading version…</>}>
                                Version info not available ({loadError()}). This usually means the running image was built before the version stamp was added; rebuild from main to populate <code>/version.json</code>.
                            </Show>
                        </p>
                    }
                >
                    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                        <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Info size={14} /> Version
                        </dt>
                        <dd class="font-mono text-gray-900 dark:text-white">{versionInfo()!.version}</dd>

                        <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Hash size={14} /> Commit
                        </dt>
                        <dd class="font-mono text-gray-900 dark:text-white">
                            <a href={`https://github.com/secanis/stjorna/commit/${versionInfo()!.commit}`} target="_blank" rel="noopener noreferrer" class="hover:underline">
                                {versionInfo()!.commit}
                            </a>
                        </dd>

                        <dt class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Calendar size={14} /> Built
                        </dt>
                        <dd class="font-mono text-gray-900 dark:text-white">{formatBuildTime(versionInfo()!.buildTime)}</dd>
                    </dl>
                </Show>
            </div>

            {/* OSS deps */}
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Open-source dependencies</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">STJÓRNA is MIT-licensed and built on top of the following libraries. Full transitive license information ships with the source tree.</p>
                <ul class="divide-y divide-gray-100 dark:divide-gray-700">
                    {DEPENDENCIES.map((d) => (
                        <li class="py-3 flex items-start gap-3">
                            <span class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 w-24 shrink-0 pt-0.5">{ROLE_LABEL[d.role] || d.role}</span>
                            <div class="flex-1 min-w-0">
                                <a href={d.url} target="_blank" rel="noopener noreferrer" class="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                                    {d.name}
                                </a>
                                <p class="text-sm text-gray-600 dark:text-gray-400">{d.description}</p>
                            </div>
                            <span class="text-xs font-mono text-gray-500 dark:text-gray-400 shrink-0 pt-0.5">{d.license}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <p class="text-xs text-gray-400 dark:text-gray-500 text-center pt-2">STJÓRNA — open source under MIT.</p>
        </div>
    );
}
