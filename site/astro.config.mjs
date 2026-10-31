// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// Served from the custom domain stjorna.secanis.ch (see public/CNAME), so
// the site is rooted at `/`. GitHub Pages redirects secanis.github.io/stjorna
// to the custom domain when a CNAME is present.
export default defineConfig({
  site: 'https://stjorna.secanis.ch',
  integrations: [
    starlight({
      title: 'STJÓRNA',
      description: 'Multi-tenant product management with a read-only REST API.',
      logo: {
        src: './src/assets/logo.png',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#0f172a' },
        },
      ],
      customCss: ['./src/styles/global.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/secanis/stjorna',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/secanis/stjorna/edit/main/site/',
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { slug: 'docs', label: 'Overview' },
            { slug: 'docs/getting-started', label: 'Getting started' },
            { slug: 'docs/installation', label: 'Installation' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'docs/configuration', label: 'Configuration' },
            { slug: 'docs/auth-roles', label: 'Authentication & roles' },
            { slug: 'docs/api-keys', label: 'API keys' },
            { slug: 'docs/oidc', label: 'OIDC / SSO' },
            { slug: 'docs/storage', label: 'Storage' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'API reference (Swagger)', link: '/docs/api/' },
            { slug: 'docs/development', label: 'Development' },
            {
              label: 'Helm chart',
              link: 'https://artifacthub.io/packages/helm/stjorna/stjorna',
              attrs: { target: '_blank' },
            },
            {
              label: 'GitHub',
              link: 'https://github.com/secanis/stjorna',
              attrs: { target: '_blank' },
            },
          ],
        },
      ],
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
