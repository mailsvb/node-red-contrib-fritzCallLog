/**
 * FritzBox.js
 * https://git.io/fritzbox
 * Licensed under the MIT License.
 * Copyright (c) 2017 Sander Laarhoven All Rights Reserved.
 */

let fritzFon = {};

const fritzLogin = require('./login.js');
const fritzRequest = require('./request.js');
const fritzFormat = require('./format.js');

const util = require('util');

/**
 * Get the history of telephone calls.
 * @param  {object} options Options object
 * @return {Promise}        Object with telephony calls.
 */
fritzFon.getCalls = (options) => {
    return new Promise(function (resolve, reject) {
        fritzLogin.getSessionId(options)
        .then((sid) => {
            options.sid = sid;
            return fritzRequest.request('/fon_num/foncalls_list.lua?csv=', 'GET', options);
        })
        .then((response) => {
            if (response.statusCode !== 200) {
                return reject(fritzRequest.findFailCause(response));
            }
            return response;
        })
        .then((response) => {
            return fritzFormat.callsCsvToJson(response.body);
        })
        .then((calls) => {
            return resolve(fritzFormat.calls(calls));
        })
        .catch((error) => {
            console.error('[FritzFon] getCalls failed: ' + util.inspect(error, { showHidden: true, depth: null }));
            return reject(error);
        })
    })
};

/**
* Download the given telephone book.
* @param  {number} phonebookId
* @param  {object} options
* @return {promise}
*/
fritzFon.getPhonebook = (phonebookId = 0, options) => {
    return new Promise(function (resolve, reject) {
        fritzLogin.getSessionId(options)
        .then((sid) => {
            options.sid = sid;
            options.removeSidFromUri = true;
            const formData = {
                sid: options.sid,
                PhonebookId: phonebookId,
                PhonebookExportName: 'Phonebook',
                PhonebookExport: ''
            };
            return fritzRequest.request('/cgi-bin/firmwarecfg', 'POST', options, false, formData);
        })
        .then((response) => {
            if (response.statusCode !== 200) {
                return reject(fritzRequest.findFailCause(response));
            }
            return response;
        })
        .then((response) => {
            return fritzFormat.xmlToJson(response.body);
        })
        .then((object) => {
            return resolve(fritzFormat.phonebook(object.phonebooks.phonebook[0].contact));
        })
        .catch((error) => {
            console.log('[FritzFon] getPhonebook failed: ' + util.inspect(error, { showHidden: true, depth: null }));
            return reject(error);
        });
    });
}

/**
 * Export fritzFon.
 */

module.exports = fritzFon;
