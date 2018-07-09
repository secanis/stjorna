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
    "revision": "7d894081ef6f4bd8d3c46ff9076318d6"
  },
  {
    "url": "assets/css/1.styles.05b0b834.css",
    "revision": "fa0e7000c1d8d18b57a385ad1d4e036f"
  },
  {
    "url": "assets/img/search.83621669.svg",
    "revision": "83621669651b9a3d4bf64d1a670ad856"
  },
  {
    "url": "assets/js/0.5485a4c4.js",
    "revision": "312660cfc0ffede9b78deba5874e2eb9"
  },
  {
    "url": "assets/js/app.2bd9c881.js",
    "revision": "43cdb5479c0bb63349adbf820cb1f895"
  },
  {
    "url": "index.html",
    "revision": "252f6ba75db52d2394ea0db363f4c031"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
