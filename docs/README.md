# STJÓRNA

STJÓRNA was created to have an easy product management with the possibility to access the categories and products over an simple just readable REST API.

![stjorna logo](https://stjorna.secanis.ch/docs/images/stjorna_middle_compressor.png "STJÓRNA Logo")

## Features

STJÓRNA is islandic and means something like manage or store stuff.
The two main goal of STJÓRNA are to be very simple in the setup and configuration effort. The second goal was to publish and share the stored data over an REST API with other applications, maybe your website.
So it is like a CMS for changing data like products or just images on your website.
The implementation on the client side is very easy and do not require much effort.

- Availability of REST API for third-party applications
- Easy setup, you will be ready in minutes
- Language support for German and English
- Possibility to export all your data as a JSON or Excel file
- Open Source software - hosted on Github
- Optional Matomo Tracking over the REST API  to monitor loading activity on categories and products

[![CircleCI](https://circleci.com/gh/secanis/stjorna/tree/master.svg?style=svg)](https://circleci.com/gh/secanis/stjorna/tree/master "Latest Build Result @CircleCI")
[![](https://images.microbadger.com/badges/version/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Get your own version badge on microbadger.com")
[![](https://images.microbadger.com/badges/image/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Get your own image badge on microbadger.com")
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/01a7269404b548058afbc8afa52e7add)](https://www.codacy.com/project/matthias.baldi/stjorna/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=secanis/stjorna&amp;utm_campaign=Badge_Grade_Dashboard)
[![Join the chat at https://gitter.im/secanis/stjorna](https://badges.gitter.im/secanis/stjorna.svg)](https://gitter.im/secanis/stjorna?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[https://hub.docker.com/r/secanis/stjorna](https://hub.docker.com/r/secanis/stjorna)

## Get Started

You have two possibilities how you can start/deploy STJÓRNA.

> You have to call https://*stjornaurl*/setup to configure your system initially.

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

## Configuration

### Setup

After the first start, you have to configure your STJÓRNA instance. You can reach the setup url over https://*stjornaurl*/setup.
In the setup process you can set the username, email and a password. After an initial setu

![stjorna setup page](https://stjorna.secanis.ch/docs/images/stjorna_setup.png "STJÓRNA Setup Page")

### ENV Variables

| Variable                       | Default       | Description                                                  |
| ------------------------------ | ------------- | ------------------------------------------------------------ |
| STJORNA_SERVER_PORT            | 3000          | Port for the Node server                                     |
| STJORNA_SERVER_MAX_UPLOAD      | 8mb           | Max image upload size, defined for Express                   |
| STJORNA_LOGLEVEL               | info          | Loglevel (WinstonJS loglevels, `slient` for no logs)         |
| STJORNACONFIG_IMAGE_WIDTH      | 700           | Image width for save process                                 |
| STJORNACONFIG_IMAGE_HEIGHT     | 700           | Image width for save process                                 |
| STJORNACONFIG_IMAGE_QUALITY    | 70            | Image quality, between 0-100%                                |
| STJORNA_REQUEST_LOG            |               | Set to `slient` for no logs                                  |
| STJORNA_CRON_CLEANUP_INTERVAL  | 00 3 * * *    | Cronjob interval to cleanup the storage                      |
| STJORNA_SERVER_STORAGE         | /app/data     | Default path is in the path of the server.js data folder     |
| STJORNA_MATOMOID               |               | Optional: PageId in Matomo to track API calls                |
| STJORNA_MATOMOURL              |               | Optional: Url of your Matomo instance, end with (/piwik.php) |
| STJORNA_MATOMOTOKEN            |               | Optional: Token to send more specific data to Matomo         |

### Remote REST API

For your third party application, in which one you want to use the public REST API, you can use the following documentation. You can load the active categories and products over this REST API including your API Key/Token.

You can enable/disable the complete API or you enable/disable categories or products.

[Remote REST API Documentation](https://stjorna.secanis.ch/apidoc/index.html)

### HTTPS / Proxy

We do not provide SSL at the moment, STJÓRNA is designed to run behind a reverse proxy which is terminating HTTPS.
Our setup is running a [Traefik](https://traefik.io/) proxy in front of STJÓRNA.

We would strongly recommend to use SSL if you use STJÓRNA!

## Screenshots

![stjorna login page](https://stjorna.secanis.ch/docs/images/stjorna_login.png "STJÓRNA Login Page")

![stjorna dashboard page](https://stjorna.secanis.ch/docs/images/stjorna_dashboard.png "STJÓRNA Dashboard Page")

![stjorna settings page](https://stjorna.secanis.ch/docs/images/stjorna_settings.png "STJÓRNA Settings Page")

##  Contribution

It would be very nice, when you give us a feedback or when you create issues if you detect problems or bugs.
If you want to fix it yourself or you have an idea for something new, please create a PR, that would help us a lot.

Happy Coding <3 ...
