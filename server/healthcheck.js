require('./lib/env_default.js');
const http = require("http");

const options = {
    host: "localhost",
    port: process.env.STJORNA_SERVER_PORT,
    timeout: 2000
};

let request = http.request(options, (res) => {
    console.info(`STATUS: ${res.statusCode}`);
    if (res.statusCode == 200) {
        process.exit(0);
    } else {
        process.exit(1);
    }
});

request.on('error', (err) => {
    console.error('ERROR');
    process.exit(1);
});

request.end();  