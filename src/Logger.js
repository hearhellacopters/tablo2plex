// @ts-check
const fs = require('fs');
const path = require('path');

const {
    C_HEX,
    LOG_TYPE,
    LOG_LEVEL,
    SAVE_LOG,
    DIR_NAME
} = require('./Constants');
const JSDate = require('./JSDate');

/**
 * Logger base class. Not to be used outside of ``Logger``
 * 
 * @class
 */
class _CustomLog {
    loc = "";
    saveLog = false;
    logType = "info";
    logLevel = 0;
    /**
     * @param {boolean} saveLog
     * @param {string} dirName
     * @param {string} logType
     * @param {number} logLevel
     */
    constructor(saveLog, dirName, logType = "info", logLevel = 0) {
        this.logType = logType;

        this.logLevel = logLevel;

        if (saveLog) {
            this.saveLog = true;

            if (!fs.existsSync(path.join(dirName, `/logs`))) {
                fs.mkdirSync(path.join(dirName, `/logs`), { recursive: true });
            }

            this.loc = path.join(dirName, `/logs/${JSDate.currentTime()}-${logType}.log`);
        }
    }

    /**
     * Log function.
     * @param {string} level - file and location
     * @param {string|number|object|boolean|undefined} text - message
     */
    log(level, text) {
        var message = text;
        if (typeof message == "number" ||
            typeof message == "boolean") {
            message = `${text}`;
        } else if (typeof message == "object" &&
                   !(message instanceof Error)) {
            message = JSON.stringify(text, null, 4);
        } else if (message == undefined) {
            message = "undefined";
        } else if (message instanceof Error) {
            message = message.message;
        }

        if (this.saveLog) {
            try {
                const writeStream = fs.createWriteStream(this.loc, { flags: 'a' });

                const regexRemove = /\x1b\[[0-9;]*[mG]/g;
                // Write the text to the file
                writeStream.write(level.replace(regexRemove, '') + " " + message.replace(regexRemove, '') + '\n');
                // Listen for the 'finish' event to know when the write operation is complete
                writeStream.on('finish', () => {
                    // Close the write stream
                    writeStream.end();
                });
            } catch (error) {
                console.error("Error writing to log file");

                console.error(error);
            }
        }

        console.log(level, message); // Call console.log
    }
};

const _cl = new _CustomLog(SAVE_LOG, DIR_NAME, LOG_TYPE, LOG_LEVEL);

/**
 * Class Logger. 
 * 
 * ```javascript 
 * // Start as new if you want to use a timer.
 * const LG = new Logger("timerLabel");
 * // End timer with:
 * LG.end(); // does NOT repect log level
 * ```
 * 
 * Use ``Logger.debug()`` - Debug log. Highest level log. Adds timestamp, filename and line.
 * 
 * Use ``Logger.warn()`` - Warn log. Logs and writes if at warn or above. Adds timestamp.
 * 
 * Use ``Logger.error()``- Error log. Logs and writes if at error or above. Adds timestamp, filename and line.
 * 
 * Use``Logger.info()`` - Info log. Always logs and writes this. No extra info.
 * 
 * Use``Logger.log()`` - For dev use only. A console.log() with file and line info. Does NOT write to log.
 * 
 * Only creates log if matching log level is met.
 */
class Logger {
    #label = "";

    #startTime = 0;

    /**
     * Only need a new constructor when using a timer with ``.end()``.
     * @param {string} label - Label for timer in logs.
     */
    constructor(label) {
        if (typeof label == "string") {
            this.#label = label;

            this.#startTime = JSDate.ct;
        }
    }
    /**
     * A ``console.log()`` with file and location.
     * 
     * Does not respect log level or write to log file.
     * 
     * Do NOT use on builds!
     * 
     * Only for temporary dev programming.
     * 
     * @static
     * @param {any} message - Message to log.
     */
    static log(...message) {

        for (var key = 0; key < message.length; key++) {
            const text = message[key];
            if (typeof text == "number" ||
                typeof text == "boolean"
            ) {
                message[key] = `${text}`;
            }
            else if (text instanceof Error) {
                message[key] = text.stack;
            }
            else if (typeof text == "object") {
                message[key] = JSON.stringify(text, null, 4);
            } else if (text == undefined) {
                message[key] = `undefined`;
            }
        }

        const err = new Error();
        // Extract the stack trace information
        const stackTrace = err.stack ? err.stack.split('\n')[2].trim() : "";
        // Updated regular expression to capture file and line information
        const match = stackTrace.match(/\s*at .+ \((.*)\)/) || stackTrace.match(/\s*at (.*)/);
        // Extract the file name, line number, and column number
        const fileName = match ? path.basename(match[1]) : null;

        console.log(`${fileName ? fileName : ""} -`, message.join(" "));
    };

    /**
     * Info log. Always logs and writes this.
     * 
     * No extra info.
     * 
     * @static
     * @param {any[]} message - Message to log.
     */
    static info(...message) {
        if (_cl.logLevel >= 0) {

            for (var key = 0; key < message.length; key++) {
                const text = message[key];
                if (typeof text == "number" ||
                    typeof text == "boolean"
                ) {
                    message[key] = `${text}`;
                }
                else if (text instanceof Error) {
                    message[key] = text.stack;
                } else if (typeof text == "object") {
                    message[key] = JSON.stringify(text, null, 4);
                }
                else if (text == undefined) {
                    message[key] = `undefined`;
                }
            }

            _cl.log(`${C_HEX.blue}[info]${C_HEX.reset}`, message.join(""));
        }
    };

    /**
     * Error log. Logs and writes if at error or above.
     * 
     * Adds timestamp, filename and line.
     * 
     * @static
     * @param {any[]} message - Message to log
     */
    static error(...message) {
        if (_cl.logLevel >= 1) {
            for (var key = 0; key < message.length; key++) {
                const text = message[key];

                if (typeof text == "number" ||
                    typeof text == "boolean"
                ) {
                    message[key] = `${text}`;
                } else if (text instanceof Error) {
                    message[key] = text.stack;
                } else if (typeof text == "object") {
                    message[key] = JSON.stringify(text, null, 4);
                }
                else if (text == undefined) {
                    message[key] = `undefined`;
                }
            }

            const err = new Error();
            // Extract the stack trace information
            const stackTrace = err.stack ? err.stack.split('\n')[2].trim() : "";
            // Updated regular expression to capture file and line information
            const match = stackTrace.match(/\s*at .+ \((.*)\)/) || stackTrace.match(/\s*at (.*)/);
            // Extract the file name, line number, and column number
            const fileName = match ? path.basename(match[1]) : null;

            const now = new Date();

            let hours = now.getHours();

            const minutes = String(now.getMinutes()).padStart(2, '0');

            const seconds = String(now.getSeconds()).padStart(2, '0');

            hours = hours % 12 || 12;

            _cl.log(`${C_HEX.red}[error ${hours}.${minutes}.${seconds}]${C_HEX.reset} ${fileName ? fileName : ""} -`, message.join(" "));
        }
    };

    /**
     * Warn log. Logs and writes if at warn or above.
     * 
     * Adds timestamp.
     * 
     * @static
     * @param {any[]} message - Message to log
     */
    static warn(...message) {
        if (_cl.logLevel >= 2) {
            for (var key = 0; key < message.length; key++) {
                const text = message[key];
                
                if (typeof text == "number" ||
                    typeof text == "boolean"
                ) {
                    message[key] = `${text}`;
                }
                else if (text instanceof Error) {
                    message[key] = text.stack;
                } else if (typeof text == "object") {
                    message[key] = JSON.stringify(text, null, 4);
                } else if (text == undefined) {
                    message[key] = `undefined`;
                }
            }

            const now = new Date();

            let hours = now.getHours();

            const minutes = String(now.getMinutes()).padStart(2, '0');

            const seconds = String(now.getSeconds()).padStart(2, '0');

            hours = hours % 12 || 12;

            _cl.log(`${C_HEX.magenta}[warn  ${hours}.${minutes}.${seconds}]${C_HEX.reset}`, message.join(" "));
        }
    };

    /**
     * Debug log. Highest level log.
     * 
     * Adds timestamp, filename and line.
     * 
     * @static
     * @param {any[]} message - Message to log
     */
    static debug(...message) {
        if (_cl.logLevel >= 3) {

            for (var key = 0; key < message.length; key++) {
                const text = message[key];

                if (typeof text == "number" ||
                    typeof text == "boolean"
                ) {
                    message[key] = `${text}`;
                }
                else if (text instanceof Error) {
                    message[key] = text.stack;
                }
                else if (typeof text == "object") {
                    message[key] = JSON.stringify(text, null, 4);
                }
                else if (text == undefined) {
                    message[key] = `undefined`;
                }
            }

            const err = new Error();
            // Extract the stack trace information
            const stackTrace = err.stack ? err.stack.split('\n')[2].trim() : "";
            // Updated regular expression to capture file and line information
            const match = stackTrace.match(/\s*at .+ \((.*)\)/) || stackTrace.match(/\s*at (.*)/);
            // Extract the file name, line number, and column number
            const fileName = match ? path.basename(match[1]) : null;

            const now = new Date();

            let hours = now.getHours();

            const minutes = String(now.getMinutes()).padStart(2, '0');

            const seconds = String(now.getSeconds()).padStart(2, '0');

            hours = hours % 12 || 12;

            _cl.log(`${C_HEX.blue}[debug ${hours}.${minutes}.${seconds}]${C_HEX.reset} ${fileName ? fileName : ""} -`, message.join(" "));
        }
    }

    /**
     * Logs ends timer if class is started with ``new`` and with a label.
     */
    end() {
        if (this.#label == "") {
            Logger.error("Timer can not end with being started with new Logger('timer label')");
        }
        const err = new Error();
        // Extract the stack trace information
        const stackTrace = err.stack ? err.stack.split('\n')[2].trim() : "";
        // Updated regular expression to capture file and line information
        const match = stackTrace.match(/\s*at .+ \((.*)\)/) ||  stackTrace.match(/\s*at (.*)/);
        // Extract the file name, line number, and column number
        const fileName = match ? path.basename(match[1]) : null;

        const dif = JSDate.ct - this.#startTime;

        const milliseconds = dif % 1000;

        const totalSeconds = Math.floor(dif / 1000);

        const seconds = totalSeconds % 60;

        const totalMinutes = Math.floor(totalSeconds / 60);

        const minutes = totalMinutes % 60;

        const hours = Math.floor(totalMinutes / 60);

        if (hours) {
            const msg = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${milliseconds} hours`;

            _cl.log(`${C_HEX.yellow}[timer ${this.#label}]${C_HEX.reset}: ${fileName ? fileName : ""} -`, msg);
        }
        if (minutes) {
            const msg = `${minutes}:${String(seconds).padStart(2, '0')}.${milliseconds} mins`;
            _cl.log(`${C_HEX.yellow}[timer ${this.#label}]${C_HEX.reset}: ${fileName ? fileName : ""} -`, msg);
        }
        if (seconds) {
            const msg = `${seconds}.${milliseconds} sec`;

            _cl.log(`${C_HEX.yellow}[timer ${this.#label}]${C_HEX.reset}: ${fileName ? fileName : ""} -`, msg);
        }
        
        _cl.log(`${C_HEX.yellow}[timer ${this.#label}]${C_HEX.reset}: ${fileName ? fileName : ""} -`, `${milliseconds} msec`);
    }
};

module.exports = Logger;