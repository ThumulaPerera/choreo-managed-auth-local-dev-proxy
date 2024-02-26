#!/usr/bin/env node


const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const fs = require('fs')
const https = require('https')
const commandLineArgs = require('command-line-args')
const path = require('path');


const cliArgDefinitions = [
    { name: 'choreoAppUrl', alias: 'u', type: String, defaultOption: true },
    { name: 'localAppPort', alias: 'p', type: Number },
    { name: 'proxyPort', alias: 'f', type: Number, defaultValue: 10000 },
    { name: 'logLevel', alias: 'l', type: String, defaultValue: 'silent'},
]

const getProxyUrl = function() {
    return `https://localhost:${this.proxyPort}`
}

const getChoreoAppUrl = function() {
    return this.choreoAppUrl
}

const getLocalAppUrl = function() {
    return `http://localhost:${this.localAppPort}`
}

configs = {
    ...commandLineArgs(cliArgDefinitions),
    getChoreoAppUrl,
    getProxyUrl,
    getLocalAppUrl,
}

const choreoProxy = createProxyMiddleware({
    target: configs.getChoreoAppUrl(),
    changeOrigin: true,
    secure: false,
    onProxyReq: (proxyReq) => {
        if (proxyReq.path.startsWith('/auth')) {
            proxyReq.setHeader('X-Use-Local-Dev-Mode', configs.getProxyUrl());
        }
    },
    ws: false,
    logLevel: configs.logLevel
})

const localProxy = createProxyMiddleware({
    target: configs.getLocalAppUrl(),
    ws: true,
    timeout: 5000,
    secure: false,
    logLevel: configs.logLevel
})

const httpsApp = express();

httpsApp.use('/auth', choreoProxy);
httpsApp.use('/choreo-apis', choreoProxy);
httpsApp.use('/', localProxy);

const keyFilePath = path.join(__dirname, 'sslcert', 'localhost.key');
const certFilePath = path.join(__dirname, 'sslcert', 'localhost.crt');

var privateKey  = fs.readFileSync(keyFilePath, 'utf8');
var certificate = fs.readFileSync(certFilePath, 'utf8');
var credentials = {key: privateKey, cert: certificate};

var httpsServer = https.createServer(credentials, httpsApp)
httpsServer.listen(configs.proxyPort, () => console.log(`Access your web application on ${configs.getProxyUrl()}`));
