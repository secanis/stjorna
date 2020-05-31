(window.webpackJsonp=window.webpackJsonp||[]).push([[5],{351:function(t,e,a){"use strict";a.r(e);var s=a(43),r=Object(s.a)({},(function(){var t=this,e=t.$createElement,a=t._self._c||e;return a("ContentSlotsDistributor",{attrs:{"slot-key":t.$parent.slotKey}},[a("h1",{attrs:{id:"stjorna"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#stjorna"}},[t._v("#")]),t._v(" STJÓRNA")]),t._v(" "),a("p",[t._v("STJÓRNA was created to have an easy product management with the possibility to access the categories and products over an simple just readable REST API.")]),t._v(" "),a("p",[a("img",{attrs:{src:"https://stjorna.secanis.ch/docs/images/stjorna_middle_compressor.png",alt:"stjorna logo",title:"STJÓRNA Logo"}})]),t._v(" "),a("h2",{attrs:{id:"features"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#features"}},[t._v("#")]),t._v(" Features")]),t._v(" "),a("p",[t._v("STJÓRNA is islandic and means something like manage or store stuff.\nThe two main goal of STJÓRNA are to be very simple in the setup and configuration effort. The second goal was to publish and share the stored data over an REST API with other applications, maybe your website.\nSo it is like a CMS for changing data like products or just images on your website.\nThe implementation on the client side is very easy and do not require much effort.")]),t._v(" "),a("ul",[a("li",[t._v("Availability of REST API for third-party applications")]),t._v(" "),a("li",[t._v("Easy setup, you will be ready in minutes")]),t._v(" "),a("li",[t._v("Language support for German and English")]),t._v(" "),a("li",[t._v("Possibility to export all your data as a JSON or Excel file")]),t._v(" "),a("li",[t._v("Open Source software - hosted on Github")]),t._v(" "),a("li",[t._v("Optional Matomo Tracking over the REST API  to monitor loading activity on categories and products")])]),t._v(" "),a("p",[a("a",{attrs:{href:"https://circleci.com/gh/secanis/stjorna/tree/master",title:"Latest Build Result @CircleCI",target:"_blank",rel:"noopener noreferrer"}},[a("img",{attrs:{src:"https://circleci.com/gh/secanis/stjorna/tree/master.svg?style=svg",alt:"CircleCI"}}),a("OutboundLink")],1),t._v(" "),a("a",{attrs:{href:"https://microbadger.com/images/secanis/stjorna",title:"Get your own version badge on microbadger.com",target:"_blank",rel:"noopener noreferrer"}},[a("img",{attrs:{src:"https://images.microbadger.com/badges/version/secanis/stjorna.svg",alt:""}}),a("OutboundLink")],1),t._v(" "),a("a",{attrs:{href:"https://microbadger.com/images/secanis/stjorna",title:"Get your own image badge on microbadger.com",target:"_blank",rel:"noopener noreferrer"}},[a("img",{attrs:{src:"https://images.microbadger.com/badges/image/secanis/stjorna.svg",alt:""}}),a("OutboundLink")],1),t._v(" "),a("a",{attrs:{href:"https://www.codacy.com/project/matthias.baldi/stjorna/dashboard?utm_source=github.com&utm_medium=referral&utm_content=secanis/stjorna&utm_campaign=Badge_Grade_Dashboard",target:"_blank",rel:"noopener noreferrer"}},[a("img",{attrs:{src:"https://api.codacy.com/project/badge/Grade/01a7269404b548058afbc8afa52e7add",alt:"Codacy Badge"}}),a("OutboundLink")],1),t._v(" "),a("a",{attrs:{href:"https://gitter.im/secanis/stjorna?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge",target:"_blank",rel:"noopener noreferrer"}},[a("img",{attrs:{src:"https://badges.gitter.im/secanis/stjorna.svg",alt:"Join the chat at https://gitter.im/secanis/stjorna"}}),a("OutboundLink")],1)]),t._v(" "),a("p",[a("a",{attrs:{href:"https://hub.docker.com/r/secanis/stjorna",target:"_blank",rel:"noopener noreferrer"}},[t._v("https://hub.docker.com/r/secanis/stjorna"),a("OutboundLink")],1)]),t._v(" "),a("h2",{attrs:{id:"get-started"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#get-started"}},[t._v("#")]),t._v(" Get Started")]),t._v(" "),a("p",[t._v("You have two possibilities how you can start/deploy STJÓRNA.")]),t._v(" "),a("blockquote",[a("p",[t._v("You have to call https://"),a("em",[t._v("stjornaurl")]),t._v("/setup to configure your system initially.")])]),t._v(" "),a("h3",{attrs:{id:"docker"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#docker"}},[t._v("#")]),t._v(" Docker")]),t._v(" "),a("p",[t._v("You can directly pull the official Docker image from Docker Hub.")]),t._v(" "),a("div",{staticClass:"language-bash extra-class"},[a("pre",{pre:!0,attrs:{class:"language-bash"}},[a("code",[t._v("docker pull secanis/stjorna\ndocker run -p "),a("span",{pre:!0,attrs:{class:"token number"}},[t._v("80")]),t._v(":3000 secanis/stjorna\n\n"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# for persisting your data")]),t._v("\ndocker run -p "),a("span",{pre:!0,attrs:{class:"token number"}},[t._v("80")]),t._v(":3000 -v path/to/storage:/app/data secanis/stjorna\n")])])]),a("h3",{attrs:{id:"nodejs"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#nodejs"}},[t._v("#")]),t._v(" NodeJS")]),t._v(" "),a("p",[t._v("Download the compressed package and unpack it in a NodeJS environment. Default Port is 3000.")]),t._v(" "),a("div",{staticClass:"language-bash extra-class"},[a("pre",{pre:!0,attrs:{class:"language-bash"}},[a("code",[a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# in this case your persist data will be under ./data")]),t._v("\nnode server/server.js\n\n"),a("span",{pre:!0,attrs:{class:"token comment"}},[t._v("# execute server api tests")]),t._v("\n"),a("span",{pre:!0,attrs:{class:"token builtin class-name"}},[t._v("cd")]),t._v(" server"),a("span",{pre:!0,attrs:{class:"token punctuation"}},[t._v(";")]),t._v(" "),a("span",{pre:!0,attrs:{class:"token function"}},[t._v("npm")]),t._v(" run "),a("span",{pre:!0,attrs:{class:"token builtin class-name"}},[t._v("test")]),t._v("\n")])])]),a("p",[t._v("Do not forget to set the NodeJS production mode: "),a("code",[t._v("process.env.NODE_ENV = 'production'")]),t._v("!")]),t._v(" "),a("h2",{attrs:{id:"configuration"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#configuration"}},[t._v("#")]),t._v(" Configuration")]),t._v(" "),a("h3",{attrs:{id:"setup"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#setup"}},[t._v("#")]),t._v(" Setup")]),t._v(" "),a("p",[t._v("After the first start, you have to configure your STJÓRNA instance. You can reach the setup url over https://"),a("em",[t._v("stjornaurl")]),t._v("/setup.\nIn the setup process you can set the username, email and a password. After an initial setu")]),t._v(" "),a("p",[a("img",{attrs:{src:"https://stjorna.secanis.ch/docs/images/stjorna_setup.png",alt:"stjorna setup page",title:"STJÓRNA Setup Page"}})]),t._v(" "),a("h3",{attrs:{id:"env-variables"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#env-variables"}},[t._v("#")]),t._v(" ENV Variables")]),t._v(" "),a("table",[a("thead",[a("tr",[a("th",[t._v("Variable")]),t._v(" "),a("th",[t._v("Default")]),t._v(" "),a("th",[t._v("Description")])])]),t._v(" "),a("tbody",[a("tr",[a("td",[t._v("STJORNA_SERVER_PORT")]),t._v(" "),a("td",[t._v("3000")]),t._v(" "),a("td",[t._v("Port for the Node server")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_SERVER_MAX_UPLOAD")]),t._v(" "),a("td",[t._v("8mb")]),t._v(" "),a("td",[t._v("Max image upload size, defined for Express")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_LOGLEVEL")]),t._v(" "),a("td",[t._v("info")]),t._v(" "),a("td",[t._v("Loglevel (WinstonJS loglevels, "),a("code",[t._v("slient")]),t._v(" for no logs)")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNACONFIG_IMAGE_WIDTH")]),t._v(" "),a("td",[t._v("700")]),t._v(" "),a("td",[t._v("Image width for save process")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNACONFIG_IMAGE_HEIGHT")]),t._v(" "),a("td",[t._v("700")]),t._v(" "),a("td",[t._v("Image width for save process")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNACONFIG_IMAGE_QUALITY")]),t._v(" "),a("td",[t._v("70")]),t._v(" "),a("td",[t._v("Image quality, between 0-100%")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_REQUEST_LOG")]),t._v(" "),a("td"),t._v(" "),a("td",[t._v("Set to "),a("code",[t._v("slient")]),t._v(" for no logs")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_CRON_CLEANUP_INTERVAL")]),t._v(" "),a("td",[t._v("00 3 * * *")]),t._v(" "),a("td",[t._v("Cronjob interval to cleanup the storage")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_SERVER_STORAGE")]),t._v(" "),a("td",[t._v("/app/data")]),t._v(" "),a("td",[t._v("Default path is in the path of the server.js data folder")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_MATOMOID")]),t._v(" "),a("td"),t._v(" "),a("td",[t._v("Optional: PageId in Matomo to track API calls")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_MATOMOURL")]),t._v(" "),a("td"),t._v(" "),a("td",[t._v("Optional: Url of your Matomo instance, end with (/piwik.php)")])]),t._v(" "),a("tr",[a("td",[t._v("STJORNA_MATOMOTOKEN")]),t._v(" "),a("td"),t._v(" "),a("td",[t._v("Optional: Token to send more specific data to Matomo")])])])]),t._v(" "),a("h3",{attrs:{id:"remote-rest-api"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#remote-rest-api"}},[t._v("#")]),t._v(" Remote REST API")]),t._v(" "),a("p",[t._v("For your third party application, in which one you want to use the public REST API, you can use the following documentation. You can load the active categories and products over this REST API including your API Key/Token.")]),t._v(" "),a("p",[t._v("You can enable/disable the complete API or you enable/disable categories or products.")]),t._v(" "),a("p",[a("a",{attrs:{href:"https://stjorna.secanis.ch/apidoc/index.html",target:"_blank",rel:"noopener noreferrer"}},[t._v("Remote REST API Documentation"),a("OutboundLink")],1)]),t._v(" "),a("h3",{attrs:{id:"https-proxy"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#https-proxy"}},[t._v("#")]),t._v(" HTTPS / Proxy")]),t._v(" "),a("p",[t._v("We do not provide SSL at the moment, STJÓRNA is designed to run behind a reverse proxy which is terminating HTTPS.\nOur setup is running a "),a("a",{attrs:{href:"https://traefik.io/",target:"_blank",rel:"noopener noreferrer"}},[t._v("Traefik"),a("OutboundLink")],1),t._v(" proxy in front of STJÓRNA.")]),t._v(" "),a("p",[t._v("We would strongly recommend to use SSL if you use STJÓRNA!")]),t._v(" "),a("h2",{attrs:{id:"screenshots"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#screenshots"}},[t._v("#")]),t._v(" Screenshots")]),t._v(" "),a("p",[a("img",{attrs:{src:"https://stjorna.secanis.ch/docs/images/stjorna_login.png",alt:"stjorna login page",title:"STJÓRNA Login Page"}})]),t._v(" "),a("p",[a("img",{attrs:{src:"https://stjorna.secanis.ch/docs/images/stjorna_dashboard.png",alt:"stjorna dashboard page",title:"STJÓRNA Dashboard Page"}})]),t._v(" "),a("p",[a("img",{attrs:{src:"https://stjorna.secanis.ch/docs/images/stjorna_settings.png",alt:"stjorna settings page",title:"STJÓRNA Settings Page"}})]),t._v(" "),a("h2",{attrs:{id:"contribution"}},[a("a",{staticClass:"header-anchor",attrs:{href:"#contribution"}},[t._v("#")]),t._v(" Contribution")]),t._v(" "),a("p",[t._v("It would be very nice, when you give us a feedback or when you create issues if you detect problems or bugs.\nIf you want to fix it yourself or you have an idea for something new, please create a PR, that would help us a lot.")]),t._v(" "),a("p",[t._v("Happy Coding ❤️ ...")])])}),[],!1,null,null,null);e.default=r.exports}}]);