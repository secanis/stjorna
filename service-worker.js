/**
 * Welcome to your Workbox-powered service worker!
 *
 * You'll need to register this file in your web app and you should
 * disable HTTP caching for this file too.
 * See https://goo.gl/nhQhGp
 *
 * The rest of the code is auto-generated. Please don't update this file
 * directly; instead, make changes to your Workbox build configuration
 * and re-run your build process.
 * See https://goo.gl/2aRDsh
 */

importScripts("https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js");

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "404.html",
    "revision": "10b6d26a14dc1ef7d71c7117e2998e6c"
  },
  {
    "url": "assets/css/0.styles.7bb73d0e.css",
    "revision": "b99073c7328565fef31b4895fa18a584"
  },
  {
    "url": "assets/img/search.83621669.svg",
    "revision": "83621669651b9a3d4bf64d1a670ad856"
  },
  {
    "url": "assets/js/2.0f4038f2.js",
    "revision": "ac3c07dd1687b332f8d66d63c115fd6c"
  },
  {
    "url": "assets/js/3.97522f61.js",
    "revision": "24df8eeb70cf7398e2314deeb1cf28fc"
  },
  {
    "url": "assets/js/4.5ba35f69.js",
    "revision": "fea0453b59ad31d4edaf6ac124d9f113"
  },
  {
    "url": "assets/js/app.85f94eea.js",
    "revision": "a044127e2a7b33d88beb34d5e60b058b"
  },
  {
    "url": "index.html",
    "revision": "1845a2e6d7492da2e7c6602210891b98"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
addEventListener('message', event => {
  const replyPort = event.ports[0]
  const message = event.data
  if (replyPort && message && message.type === 'skip-waiting') {
    event.waitUntil(
      self.skipWaiting().then(
        () => replyPort.postMessage({ error: null }),
        error => replyPort.postMessage({ error })
      )
    )
  }
})
