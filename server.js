#!/usr/bin/env node

/**
 * Copyright (c) 2024, WSO2 LLC. (https://www.wso2.com). All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
