/**
 * FritzBox.js
 * https://git.io/fritzbox
 * Licensed under the MIT License.
 * Copyright (c) 2017 Sander Laarhoven All Rights Reserved.
 */

const fritzRequest = require('./request.js');

const util = require('util');

let fritzLogin = {};

/**
 * Login to the Fritz!Box and obtain a sessionId.
 * @param  {object} options Options object
 * @return {string}         sessionId
 */
fritzLogin.getSessionId = (options) => {
    return new Promise(function (resolve, reject) {
    // Do we have a options.sid value?
        if (options.sid) {
            // SIDs _do_ expire!
            return resolve(options.sid);
        }
        // Request a challenge.
        fritzRequest.request('/login_sid.lua', 'GET', options)
        // Solve the presented challenge.
        .then((response) => {
            const challenge = response.body.match('<Challenge>(.*?)</Challenge>')[1];
            const buffer = Buffer(challenge + '-' + options.password, 'UTF-16LE');
            const challengeResponse = challenge + '-' + require('crypto').createHash('md5').update(buffer).digest('hex');
            const path = '/login_sid.lua?username=' + options.username + '&response=' + challengeResponse;
            return fritzRequest.request(path, 'GET', options);
        })
        // Check the response.
        .then((response) => {
            if (response.statusCode !== 200) {
                return reject(fritzRequest.findFailCause(response));
            }
            return response;
        })
        // Obtain the SID.
        .then((response) => {
            const sessionId = response.body.match('<SID>(.*?)</SID>')[1];
            if (sessionId === '0000000000000000') {
                return reject('Could not login to Fritz!Box. Invalid login?');
            }
            return resolve(sessionId);
        })
        // Catch errors.
        .catch((error) => {
            console.log('[FritzLogin] getSessionId failed: ' + util.inspect(error, { showHidden: true, depth: null }));
            return reject(error);
        });
    });
};

/**
 * Export fritzLogin.
 */

module.exports = fritzLogin;
