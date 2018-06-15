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
    "revision": "912cf61fce191160ebcf8082481fcbc6"
  },
  {
    "url": "assets/css/1.styles.cc4495ee.css",
    "revision": "8a721a7e36db866c4c47fef8c8f87019"
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
    "url": "assets/js/app.3de6e21b.js",
    "revision": "e53e6664cb16ea3ab9ef9011db4c2f4f"
  },
  {
    "url": "index.html",
    "revision": "2e8df24b76c2ca2eae4f973b7dad8b15"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
