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

importScripts("https://storage.googleapis.com/workbox-cdn/releases/3.2.0/workbox-sw.js");

/**
 * The workboxSW.precacheAndRoute() method efficiently caches and responds to
 * requests for URLs in the manifest.
 * See https://goo.gl/S9QRab
 */
self.__precacheManifest = [
  {
    "url": "404.html",
    "revision": "869e552aa7464945de96fd613738addc"
  },
  {
    "url": "assets/css/1.styles.0671d4a5.css",
    "revision": "fa0e7000c1d8d18b57a385ad1d4e036f"
  },
  {
    "url": "assets/img/search.83621669.svg",
    "revision": "83621669651b9a3d4bf64d1a670ad856"
  },
  {
    "url": "assets/js/0.8439a19d.js",
    "revision": "d6e8688f295b6fc5dedcffc73435388a"
  },
  {
    "url": "assets/js/app.6f67aa9f.js",
    "revision": "6462a6e49903e124ac91b3a82418d6f9"
  },
  {
    "url": "index.html",
    "revision": "7600c1ef247cc8f04df7ea401e15489a"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
