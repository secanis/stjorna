module.exports = {
  base: "/",
  locales: {
    '/': {
      lang: 'en-US',
      title: 'STJÓRNA',
      description: 'STJÓRNA was created to be an easy product management with the possibility to access the categories and products over an simple just readable REST API.'
    }
  },
  head: [
    ['link', { rel: 'icon', href: `/favicon.ico` }],
    ['link', { rel: 'manifest', href: '/manifest.json' }]
  ],
  serviceWorker: true,
  themeConfig: {
    repo: 'secanis/stjorna',
    editLinks: true,
    docsDir: 'docs',
    markdown: {
      lineNumbers: true
    },
    locales: {
      '/': {
        label: 'English',
        selectText: 'Languages',
        lastUpdated: 'Last Updated',
        nav: [
          {
            text: 'Features',
            link: 'index.html#features',
          },
          {
            text: 'Get Started',
            link: 'index.html#get-started'
          },
          {
            text: 'Configuration',
            link: 'index.html#configuration'
          },
          {
            text: 'Screenshots',
            link: 'index.html#screenshots'
          }
        ]
      }
    }
  }
}