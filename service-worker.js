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
    "revision": "195649b02dd7d3be11aa3d4fd73594c5"
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
    "url": "assets/js/0.ff05cfae.js",
    "revision": "b383660d807c3d8070c91bcaf7c47adf"
  },
  {
    "url": "assets/js/app.19e171dd.js",
    "revision": "c4e818ffad389f8dd98d65c00cf452ff"
  },
  {
    "url": "index.html",
    "revision": "6f685b7e11e74f38a73366df7fddea6e"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
