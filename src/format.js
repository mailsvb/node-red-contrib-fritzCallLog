/**
 * FritzBox.js
 * https://git.io/fritzbox
 * Licensed under the MIT License.
 * Copyright (c) 2017 Sander Laarhoven All Rights Reserved.
 */

let fritzFormat = {};

const csvjson = require('csvjson');
const parseString = require('xml2js').parseString;

/**
 * Format a raw calls array to a more readable array.
 * @param  {array} calls
 * @return {array}
 */
fritzFormat.calls = (calls) => {
    let formattedCalls = [];
    for (var i in calls) {
        if (typeof calls[i] === 'object') {
            formattedCalls[i] = {
                type: fritzFormat.callType(calls[i].Typ),
                time: fritzFormat.date(calls[i].Datum),
                name: calls[i].Name,
                duration: calls[i].Dauer,
                phoneNumber: calls[i].Rufnummer,
                ownNumber: calls[i].EigeneRufnummer,
                extension: calls[i].Nebenstelle
            };
        }
    }
    return formattedCalls;
};

/**
 * Format calls CSV to object.
 * @param  {string} csvData
 * @return {object}
 */
fritzFormat.callsCsvToJson = (csvData) => {
    let parsableCsvData = csvData
                          .replace('sep=;', '')
                          .replace('Eigene Rufnummer', 'EigeneRufnummer')
                          .trim();
    const formattedBody = csvjson.toObject(parsableCsvData, {delimiter: ';'});
    return formattedBody;
};

/**
 * Get the human-understandable type of a call.
 * @param  {string} type 1-4
 * @return {string}
 */
fritzFormat.callType = (type) => {
    return type
           .replace('1', 'received')
           .replace('2', 'missed')
           .replace('3', 'unknown')
           .replace('4', 'placed');
};

/**
 * Format dd.mm.yy hh:mm to a Date string.
 * @param  {string} rawDate
 * @return {string}
 */
fritzFormat.date = (rawDate) => {
	// get vars from dd.mm.yy hh:mm format.
	let parts = rawDate.split(' ');
	let date = parts[0];
	let time = parts[1];

	let dateParts = date.split('.');
	let day = dateParts[0];
	let month = dateParts[1];
	let year = '20' + dateParts[2];

	let timeParts = time.split(':');
	let hours = timeParts[0];
	let minutes = timeParts[1];
	
	return year + "-" + month + "-" + day + "T" + hours + ":" + minutes + ":00";
}

/**
 * Convert XML to JSON object.
 * @param  {string} tmpPath
 * @return {promise}
 */
fritzFormat.xmlToJson = (xml) => {
    return new Promise(function (resolve, reject) {
        parseString(xml, (error, result) => {
            if (error) return reject(error);
            return resolve(result);
        });
    });
};

/**
 * Format an ugly phonebook object to a sane object.
 * @param  {object} object
 * @return {object}
 */
fritzFormat.phonebook = (phonebook) => {
    let formattedPhonebook = [];
    for (var i in phonebook) {
        formattedPhonebook[i] = {
            uniqueId: phonebook[i].uniqueid[0],
            name: phonebook[i].person[0].realName[0],
            numbers: [],
            category: phonebook[i].category[0]
        };
        const numbers = phonebook[i].telephony[0].number;
        for (var n in numbers) {
            let number = numbers[n];
            formattedPhonebook[i].numbers[n] = {
                number: number._,
                type: number.$.type,
                priority: number.$.prio,
                quickdial: number.$.quickdial
            };
        }
        if (phonebook[i].services[0].email) {
            formattedPhonebook[i].email = phonebook[i].services[0].email[0]._;
        }
        if (phonebook[i].mod_time) {
            formattedPhonebook[i].lastModified = phonebook[i].mod_time[0];
        }
        if (phonebook[i].setup[0].ringTone) {
            formattedPhonebook[i].ringtone = phonebook[i].setup[0].ringTone[0];
        }
    }
    return formattedPhonebook;
}

/**
 * Export fritzFon.
 */

module.exports = fritzFormat;
