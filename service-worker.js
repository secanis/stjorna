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
    "revision": "c7c69b23fb20f01b8473e6e8b5a9cf84"
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
    "url": "assets/js/0.88e87537.js",
    "revision": "c654f18fbf4bbedd950720ccecc88f23"
  },
  {
    "url": "assets/js/app.683cf38b.js",
    "revision": "2182161e564128b14007e93ac1df658c"
  },
  {
    "url": "index.html",
    "revision": "dbf33c2ec579f43eda7e28841dd65476"
  }
].concat(self.__precacheManifest || []);
workbox.precaching.suppressWarnings();
workbox.precaching.precacheAndRoute(self.__precacheManifest, {});
