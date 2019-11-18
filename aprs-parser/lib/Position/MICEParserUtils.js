'use strict';

var MICEPosition = require("../MessageModels").MICEPosition;
var CourseSpeed = require("../PostionExtensions/ExtensionModels").CourseSpeed;
var UncompressedPositionParserUtils = require("./UncompressedPositionParserUtil");

var arraysIdentical = function (a, b) {
    if (a.length != b.length)
        return false;

    for (var i = 0; i < a.length; i++) {
        if (a[i] != b[i])
            return false;
    }

    return true;
};

module.exports = {
    getInfoForDestinationAddressChar: function (c) {
        //0 - 0, 1 - 1 custom, 2 - 1 std
        var asciiCode = c.charCodeAt(0);
        var ret = {latDigit: 0, message: 0, isNorth: false, longOffset: 0, isWest: false};

        if (c >= "0" && c <= "9") {
            ret.latDigit = asciiCode - "0".charCodeAt(0);
        }
        else if (c >= "A" && c <= "J") {
            ret.latDigit = asciiCode - "A".charCodeAt(0);
            ret.message = 1;
            ret.isNorth = null;
            ret.longOffset = null;
            ret.isWest = null;
        }
        else if (c == "K") {
            ret.latDigit = 0;
            ret.message = 1;
            ret.isNorth = null;
            ret.longOffset = null;
            ret.isWest = null;
        }
        else if (c == "L") {
            ret.latDigit = 0;
            ret.message = 0;
        }
        else if (c >= "P" && c <= "Y") {
            ret.latDigit = asciiCode - "P".charCodeAt(0);
            ret.message = 2;
            ret.isNorth = true;
            ret.longOffset = 100;
            ret.isWest = true;
        }
        else if (c == "Z") {
            ret.latDigit = 0;
            ret.message = 2;
            ret.isNorth = true;
            ret.longOffset = 100;
            ret.isWest = true;
        }

        return ret;
    },

    getStateFromMessage: function (message) {
        /*
         Message: array, 3 elements, values: 0 - 0, 1 - 1 custom, 2 - 1 std
         */
        if (message.length != 3)
            throw new Error("Message array should contain 3 elements");

        if (message[0] == 0 && message[1] == 0 && message[2] == 0)
            return MICEPosition.State.EMERGENCY;

        var isStd = message[0] == 2 || message[1] == 2 || message[2] == 2;
        var isCustom = message[0] == 1 || message[1] == 1 || message[2] == 1;

        if (isStd && isCustom)
            return MICEPosition.State.UNKNOWN;

        message[0] = message[0] == 2 ? 1 : message[0];
        message[1] = message[1] == 2 ? 1 : message[1];
        message[2] = message[2] == 2 ? 1 : message[2];

        if (arraysIdentical(message, [1, 1, 1]))
            return isStd ? MICEPosition.State.M0 : MICEPosition.State.C0;
        else if (arraysIdentical(message, [1, 1, 0]))
            return isStd ? MICEPosition.State.M1 : MICEPosition.State.C1;
        else if (arraysIdentical(message, [1, 0, 1]))
            return isStd ? MICEPosition.State.M2 : MICEPosition.State.C2;
        else if (arraysIdentical(message, [1, 0, 0]))
            return isStd ? MICEPosition.State.M3 : MICEPosition.State.C3;
        else if (arraysIdentical(message, [0, 1, 1]))
            return isStd ? MICEPosition.State.M4 : MICEPosition.State.C4;
        else if (arraysIdentical(message, [0, 1, 0]))
            return isStd ? MICEPosition.State.M5 : MICEPosition.State.C5;
        else if (arraysIdentical(message, [0, 0, 1]))
            return isStd ? MICEPosition.State.M6 : MICEPosition.State.C6;
        else
            return MICEPosition.State.UNKNOWN;
    },

    readDataFromDestinationAddress: function (destinationAddressString) {
        if (destinationAddressString.length != 6)
            throw new Error("Wrong lenght of destination address");

        var latitudeDigits = [];
        var message = [];
        var isNorth = false;
        var longOffset = 0;
        var isWest = false;

        for (var i = 1; i <= 6; i++) {
            var values = this.getInfoForDestinationAddressChar(destinationAddressString[i - 1]);

            latitudeDigits.push(values.latDigit);

            if (i >= 1 && i <= 3) {
                message.push(values.message);
            }

            if (i == 4)
                isNorth = values.isNorth;

            if (i == 5)
                longOffset = values.longOffset;

            if (i == 6)
                isWest = values.isWest;
        }

        var degrees = 10 * latitudeDigits[0] + latitudeDigits[1];
        var minutes = 10 * latitudeDigits[2] + latitudeDigits[3] + ((10 * latitudeDigits[4] + latitudeDigits[5]) / 100);
        var latitude = (isNorth ? 1 : -1) * degrees + (minutes / 60);


        return {
            latitude: latitude,
            miceState: this.getStateFromMessage(message),
            logitudeOffset: longOffset,
            isWest: isWest
        };
    },

    parseLogitudeFormat: function (logitudeString, longitudeOffset, isWest) {
        //degrees
        var d = longitudeOffset + (logitudeString[0].charCodeAt(0) - 28);
        if (d >= 180 && d <= 189)
            d = d - 80;
        else if (d >= 190 && d <= 199)
            d = d - 190;

        //minutes
        var m = logitudeString[1].charCodeAt(0) - 28;
        if (m >= 60)
            m = m - 60;

        //hundredths of minutes
        var h = logitudeString[2].charCodeAt(0) - 28;

        var minutes = m + (h / 100);

        return (isWest ? -1 : 1) * (d + (minutes / 60));
    },
    
    parseCourseAndSpeed: function (data) {
        var sp = data.charCodeAt(0) - 28;
        var dc = data.charCodeAt(1) - 28;
        var se = data.charCodeAt(2) - 28;

        var speedKnots = sp * 10 + Math.floor(dc / 10);
        var courseDeg = ((dc % 10) * 100) + se;

        if(speedKnots >= 800)
            speedKnots -= 800;

        if(courseDeg >= 400)
            courseDeg -= 400;

        return new CourseSpeed(courseDeg, UncompressedPositionParserUtils.knotsToMetersPerSecond(speedKnots));
    }

};