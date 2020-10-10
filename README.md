# STJÓRNA

STJÓRNA was created to have an easy product management with the possibility to access the categories and products over an simple just readable REST API.

![stjorna logo](https://stjorna.secanis.ch/docs/images/stjorna_middle_compressor.png "STJÓRNA Logo")

## Features

[![CircleCI](https://circleci.com/gh/secanis/stjorna/tree/master.svg?style=svg)](https://circleci.com/gh/secanis/stjorna/tree/master "Latest Build Result @CircleCI")
[![](https://images.microbadger.com/badges/version/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Get your own version badge on microbadger.com")
[![](https://images.microbadger.com/badges/image/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Get your own image badge on microbadger.com")
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/01a7269404b548058afbc8afa52e7add)](https://www.codacy.com/project/matthias.baldi/stjorna/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=secanis/stjorna&amp;utm_campaign=Badge_Grade_Dashboard) [![Join the chat at https://gitter.im/secanis/stjorna](https://badges.gitter.im/secanis/stjorna.svg)](https://gitter.im/secanis/stjorna?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

STJÓRNA is islandic and means something like manage or store stuff.
The two main goal of STJÓRNA are to be very simple in the setup and configuration effort. The second goal was to publish and share the stored data over an REST API with other applications, maybe your website.
So it is like a CMS for changing data like products or just images on your website.
The implementation on the client side is very easy and do not require much effort.

- Availability of REST API for third-party applications
- Easy setup, you will be ready in minutes
- Language support for German and English
- Possibility to export all your data as a JSON, Excel or complete backup as a ZIP file - No vendor lock!
- Open Source software - hosted on Github
- Optional Matomo Tracking over the REST API  to monitor loading activity on categories and products

![Screenshot Stjorna](https://stjorna.secanis.ch/docs/images/stjorna_dashboard.png)

## Get Started

You have two possibilities how you can start/deploy STJÓRNA:

### Docker

You can directly pull the official Docker image from Docker Hub.

``` bash
docker pull secanis/stjorna
docker run -p 80:3000 secanis/stjorna

# for persisting your data
docker run -p 80:3000 -v path/to/storage:/app/data secanis/stjorna
```

### NodeJS

Download the compressed package and unpack it in a NodeJS environment. Default Port is 3000.

``` bash
# in this case your persist data will be under ./data
node server/server.js

# execute server api tests
cd server; npm run test
```

Do not forget to set the NodeJS production mode: `process.env.NODE_ENV = 'production'`!

### Cofiguration & Setup

Call `https://<yourStjornaInstance>/setup` to configure Stjorna initially.
For more information please have a look on our documentation: [https://stjorna.secanis.ch](https://stjorna.secanis.ch).

##  Contribution

It would be very nice, when you give us a feedback or when you create issues if you detect problems or bugs.
If you want to fix it yourself or you have an idea for something new, please create a PR, that would help us a lot.

Happy Coding <3 ...
