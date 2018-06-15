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
    "revision": "5ea77536e5db4809ffe3a7479d1acfe9"
  },
  {
    "url": "assets/css/1.styles.95c4c4f7.css",
    "revision": "afcb23a7c8289221d22a18402e70774e"
  },
  {
    "url": "assets/img/search.83621669.svg",
    "revision": "83621669651b9a3d4bf64d1a670ad856"
  },
  {
    "url": "assets/js/0.a0b21bad.js",
    "revision": "d391071f3b1490c8c21204cde04e72bd"
  },
  {
    "url": "assets/js/app.1ba9699a.js",
    "revision": "b449e659c479ae04a78cf5c17873cf4c"
  },
  {
    "url": "index.html",
    "revision": "4589a705530fedfb4ce0a66ba606894d"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
