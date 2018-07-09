# STJÓRNA

STJÓRNA was created to have an easy product management with the possibility to access the categories and products over an simple just readable REST API.

![stjorna logo](https://stjorna.secanis.ch/docs/images/stjorna_middle_compressor.png "STJÓRNA Logo")

## Features

STJÓRNA is islandic and means something like manage or store stuff.
The two main goal of STJÓRNA are to be very simple in the setup and configuration effort. The second goal was to publish and share the stored data over an REST API with other applications, maybe your website.

## Get Started

You have two possibilities how you can start/deploy STJÓRNA.

> You have to call https://*stjornaurl*/setup to configure your system initially.

### Docker

You can directly pull the official Docker image from Docker Hub.

``` bash
docker pull secanis/stjorna
docker run -p 80:3000 secanis/stjorna
```

[![](https://images.microbadger.com/badges/image/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Get your own image badge on microbadger.com") [![](https://images.microbadger.com/badges/version/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Get your own version badge on microbadger.com")

[https://hub.docker.com/r/secanis/stjorna](https://hub.docker.com/r/secanis/stjorna)

### NodeJS

Download the compressed package and unpack it in a NodeJS environment. Default Port is 3000.

``` bash
node server.js
```

## Configuration

### Setup

After the first start, you have to configure your STJÓRNA instance. You can reach the setup url over https://*stjornaurl*/setup.
In the setup process you can set the username, email and a password. After an initial setu

![stjorna setup page](https://stjorna.secanis.ch/docs/images/stjorna_setup.png "STJÓRNA Setup Page")

### ENV Variables

| Variable                       | Default       | Description                                               |
| ------------------------------ | ------------- | --------------------------------------------------------- |
| STJORNA_SERVER_PORT            | 3000          | Port for the Node server                                  |
| STJORNA_SERVER_MAX_UPLOAD      | 5mb           | Max image upload size, defined for Express                |
| STJORNA_LOGLEVEL               | error         | Loglevel                                                  |
| STJORNA_CRON_CLEANUP_INTERVAL  | */30 * * * *  | Cronjob interval to cleanup the storage                   |
| STJORNA_SERVER_STORAGE         | process.cwd() | Default path is in the path of the server.js data folder  |

### Remote REST API

For your third party application, in which one you want to use the public REST API, you can use the following documentation. You can load the active categories and products over this REST API including your API Key/Token.

You can enable/disable the complete API or you enable/disable categories or products.

[Remote REST API Documentation](https://stjorna.secanis.ch/apidoc/index.html)

## Screenshots

![stjorna login page](https://stjorna.secanis.ch/docs/images/stjorna_login.png "STJÓRNA Login Page")

![stjorna dashboard page](https://stjorna.secanis.ch/docs/images/stjorna_dashboard.png "STJÓRNA Dashboard Page")

![stjorna settings page](https://stjorna.secanis.ch/docs/images/stjorna_settings.png "STJÓRNA Settings Page")