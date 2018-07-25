# STJÓRNA

STJÓRNA was created to have an easy product management with the possibility to access the categories and products over an simple just readable REST API.

![stjorna logo](https://stjorna.secanis.ch/docs/images/stjorna_middle_compressor.png "STJÓRNA Logo")

## Features

[![CircleCI](https://circleci.com/gh/secanis/stjorna/tree/master.svg?style=svg)](https://circleci.com/gh/secanis/stjorna/tree/master "Latest Build Result @CircleCI")
[![](https://images.microbadger.com/badges/image/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Stjorna Docker Image")
[![](https://images.microbadger.com/badges/version/secanis/stjorna.svg)](https://microbadger.com/images/secanis/stjorna "Stjorna Latest Version")

STJÓRNA is islandic and means something like manage or store stuff.
The two main goal of STJÓRNA are to be very simple in the setup and configuration effort. The second goal was to publish and share the stored data over an REST API with other applications, maybe your website.

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

### Cofiguration

For more information please have a look on our website: [https://stjorna.secanis.ch](https://stjorna.secanis.ch).