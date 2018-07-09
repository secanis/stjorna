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
    "revision": "04c5bb904a9beb04b7de225a645425d4"
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
    "url": "assets/js/0.d25c79e9.js",
    "revision": "bb41f4a968d195dfebea4ad2cc753a45"
  },
  {
    "url": "assets/js/app.32a3ad48.js",
    "revision": "e553092eef5f8053cb56e59f0e6c7a45"
  },
  {
    "url": "index.html",
    "revision": "014942cee373a7e23e73c3d53203a1bf"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
