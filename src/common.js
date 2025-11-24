// @ts-check
/**
 * @typedef {import('node:buffer').Buffer} Buffer
 * @typedef {import('node:querystring').ParsedUrlQuery} ParsedUrlQuery
 */

require('dotenv').config();
const pack = require('../package.json');
const { Command } = require('commander');
const keypress = require('keypress');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    confirm,
    checkbox,
    select,
    password,
    Separator
} = require('@inquirer/prompts');
const inputs = require('@inquirer/prompts').input;
const {
    createHmac,
    createHash,
    createCipheriv,
    createDecipheriv
} = require("crypto");

/**
 * App version
 */
const VERSION = pack.version;

/**
 * How the app parses arguments passed to it at the command line level.
 * 
 * @class
 */
const PROGRAM = new Command();

/**
 * For console log colors
 * 
 * @readonly
 * @enum {string}
 */
const C_HEX = {
    white: '\x1b[37m',
    black: '\x1b[30m',
    red: '\x1b[31m', //error
    green: '\x1b[32m',
    yellow: '\x1b[33m', //info
    blue: '\x1b[36m', //debug
    magenta: '\x1b[35m', //warn

    red_back: '\x1b[41m',
    green_back: '\x1b[42m',
    yellow_back: '\x1b[43m',
    blue_back: '\x1b[46m',
    magenta_back: '\x1b[45m',
    white_back: '\x1b[47m',

    red_yellow: '\x1b[31;43m',
    reset: '\x1b[0m'  // ending
};

// Set commands to program for
PROGRAM
    .name(pack.name)
    .description(`${C_HEX.blue}Tablo2Plex server${C_HEX.reset}`)
    .version(pack.version)
    .addHelpText(`beforeAll`, "Use the .env file to set options")
    .option('-c, --creds', 'Force creation of new creds file.')
    .option('-l, --lineup', 'Force creation of a fresh channel lineup file.')

    .option('-n, --name <string>', 'Name of the device that shows up in Plex. (overides .env file)')
    .option('-f, --id <string>', 'Fake ID of the device for when you have more than one device on the network. (overides .env file)')
    .option('-p, --port <string>', 'Overide the port. (overides .env file)')
    .option('-i, --interval <number>', 'How often the app rechecks the server for the channel lineup in days. (overides .env file)')
    .option('-x, --xml <boolean>', 'If you want to create an xml guide for the channels from Tablo\'s data instead of Plex. (overides .env file)')
    .option('-d, --days <number>', 'The amount of days the guide will populate (overides .env file)')
    .option('-s, --pseudo <boolean>', 'Include the guide data with your guide as long as it\'s at \/.pseudotv\/xmltv.xml (overides .env file)')
    .option('-g, --level <boolean>', 'Logger level. (overides .env file)')
    .option('-k, --log <boolean>', 'If you want to create a log file of all console output. (overides .env file)')
    .option('-o, --outdir <string>', 'Overide the output directory. Default is excution directory (overides .env file)')
    .option('-v, --device <string>', 'Server ID of the Tablo device to use if you have more than 1. (overides .env file)')
    .option('-u, --user <string>', 'Username to use for when creds.bin isn\'t present. (Note: will auto select profile)')
    .option('-w, --pass <string>', 'Password to use for when creds.bin isn\'t present. (Note: will auto select profile)');
    
PROGRAM.parse(process.argv);

/**
 * Command line arguments.
 */
const ARGV = PROGRAM.opts();

/**
 * Path where server outputs files.
 * 
 * @returns {string} directory name
 */
function _get_dir_name() {
    if(ARGV.outdir){
        return ARGV.outdir;
    } else if(process.env.OUT_DIR){
        return ARGV.OUT_DIR;
    // @ts-ignore
    } else if (process.pkg) {
        return path.dirname(process.execPath);
    } else {
        return process.cwd();
    }
};

/**
 * Path where server outputs files.
 * 
 * Used in finding files to load.
 */
const DIR_NAME = _get_dir_name();

/**
 * confrims username to use, will prompt otherwise
 * 
 * @returns {string|undefined} port
 */
function _confrim_username() {
    if(ARGV.user){
        return ARGV.user;
    //check env
    } else if (process.env.USER_NAME) {
        return process.env.USER_NAME;
    } else {
        return undefined;
    }
};

/**
 * User name for auto creds.bin creation.
 */
const USER_NAME = _confrim_username();

/**
 * confrims password to use, will prompt otherwise
 * 
 * @returns {string|undefined} port
 */
function _confrim_password() {
    if(ARGV.pass){
        return ARGV.pass;
    //check env
    } else if (process.env.USER_PASS) {
        return process.env.USER_PASS;
    } else {
        return undefined;
    }
};

/**
 * User password for auto creds.bin creation.
 */
const USER_PASS = _confrim_password();

/**
 * For auto selection a profile.
 */
const AUTO_PROFILE = USER_NAME != undefined ? true : false;

/**
 * For confriming log level for Logger.
 * 
 * @returns {string} string
 */
function _confrim_log_level() {
    var level;
    if(ARGV.level){
        level = ARGV.level;
    } else {
        level = process.env.LOG_LEVEL;
    }
    switch (level) {
        case "info":
        case "warn":
        case "error":
        case "debug":
            return level;
        default:
            return "error";
    }
};

/**
 * Log level for server logging.
 */
const LOG_LEVEL = _confrim_log_level();

/**
 * IP Address of the machine.
 */
const IP_ADDRESS = _get_local_IPv4_address();

/**
 * confrims port in use
 * 
 * @returns {string} port
 */
function _confrim_port() {
    if(ARGV.port){
        return ARGV.port;
    //check env
    } else if (process.env.PORT == "" || process.env.PORT == undefined) {
        return "8181";
    } else {
        return process.env.PORT;
    }
};

/**
 * Port the server is using.
 */
const PORT = _confrim_port();

/**
 * Get a boolean string
 * 
 * @param {string|undefined} value 
 */
function _confrim_boolean(value) {
    if (typeof value == "boolean"){
        return value;
    } 
    else if (value == undefined) {
        return false;
    }
    else if (typeof value != "string") {
        return false;
    }
    else if (value.toLowerCase() == "true") {
        return true;
    }
    else {
        return false;
    }
}

/**
 * confrim to save logs
 */
function _confrim_save_log(){
    if(ARGV.log){
        return _confrim_boolean(ARGV.log);
    //check env
    } else if (process.env.SAVE_LOG) {
        return _confrim_boolean(process.env.SAVE_LOG);
    } else {
        return false;
    }
}

const SAVE_LOG = _confrim_save_log();

/**
 * confrim xml file output
 */
function _confrim_xml(){
    if(ARGV.xml){
        return _confrim_boolean(ARGV.xml);
    //check env
    } else if (process.env.CREATE_XML) {
        return _confrim_boolean(process.env.CREATE_XML);
    } else {
        return false;
    }
}

const CREATE_XML = _confrim_xml();

/**
 * confrim xml file output
 */
function _confrim_pseudo(){
    if(ARGV.pseudo){
        return _confrim_boolean(ARGV.pseudo);
    //check env
    } else if (process.env.INCLUDE_PSEUDOTV_GUIDE) {
        return _confrim_boolean(process.env.INCLUDE_PSEUDOTV_GUIDE);
    } else {
        return false;
    }
}

const INCLUDE_PSEUDOTV_GUIDE = _confrim_pseudo();

/**
 * Day to pull in advance for line up
 */
function _confrim_guide_days() {
    if(ARGV.days){
        var num = Number(ARGV.days);
        if (num > 0 && num < 8) {
            return num;
        }
        else {
            return 2;
        }
    //check env
    } else if (process.env.GUIDE_DAYS == "" || process.env.GUIDE_DAYS == undefined) {
        return 2;
    } else {
        var num = Number(process.env.GUIDE_DAYS);
        if (num > 0 && num < 8) {
            return num;
        }
        else {
            return 2;
        }
    }
}

const GUIDE_DAYS = _confrim_guide_days();

/**
 * for creating and confriming the server URL for the server.
 * 
 * @param {string} PORT
 * @returns {string} url string
 */
function _confrim_url(PORT) {
    return `http://${IP_ADDRESS}:${PORT}`;
};

/**
 * URL of the machine the server connects to.
 * 
 * As ``http://${IP_ADDRESS}:${PORT}``
 */
const SERVER_URL = _confrim_url(PORT);

/**
 * For creating log level for Logger
 * 
 * @returns {number} log number
 */
function _find_log_level() {
    switch (LOG_LEVEL) {
        case "info":  // No extra info
            return 0;
        case "error":  // adds timestamp info
            return 1;
        case "warn":  // adds timestamp + Error info
            return 2;
        case "debug": // adds timestamp + Error info
            return 3;
        default:
            // info
            return 0;
    }
};

/**
 * Interal log level as number for Logger.
 */
const _LOG_LEVEL = _find_log_level();

/**
 * confrims name of device
 */
function _confrim_name(){
    if(ARGV.name){
        return ARGV.name;
    //check env
    } else if (process.env.NAME) {
        return process.env.NAME;
    } else {
        return "Tablo 4th Gen Proxy";
    }
}

/**
 * Name of the device
 */
const NAME = _confrim_name();

/**
 * confrims name of device
 */
function _confrim_id(){
    if(ARGV.id){
        return ARGV.id;
    //check env
    } else if (process.env.DEVICE_ID) {
        return process.env.DEVICE_ID;
    } else {
        return "12345678";
    }
}

const DEVICE_ID = _confrim_id();

/**
 * Master function for finding machine IP address.
 * 
 * @returns {string} example ``'127.0.0.1'``
 */
function _get_local_IPv4_address() {
    const interfaces = os.networkInterfaces();

    for (const interfaceName in interfaces) {
        const networkInterface = interfaces[interfaceName];

        if (networkInterface) {
            for (const entry of networkInterface) {
                if (!entry.internal && entry.family === 'IPv4') {
                    return entry.address;
                }
            }
        }
    }

    return '127.0.0.1'; // Default to localhost if no external IPv4 address is found
};

/**
 * confrims update interval
 */
function _confrim_interval(){
    if(ARGV.interval){
        if(Number.isNaN(Number(ARGV.interval))){
            return 30 * (24 * 60 * 60 * 1000);
        }
        return Number(ARGV.interval) * (24 * 60 * 60 * 1000)
    //check env
    } else if (process.env.LINEUP_UPDATE_INTERVAL) {
        if(Number.isNaN(Number(process.env.LINEUP_UPDATE_INTERVAL))){
            return 30 * (24 * 60 * 60 * 1000);
        }
        return Number(process.env.LINEUP_UPDATE_INTERVAL) * (24 * 60 * 60 * 1000)
    } else {
        return 30 * (24 * 60 * 60 * 1000);
    }
}

/**
 * Time in days for each lineup update
 */
const LINEUP_UPDATE_INTERVAL = _confrim_interval();

/**
 * confrims device to use
 */
function _confrim_device() {
    if (ARGV.device) {
        return ARGV.device;
        //check env
    } else if (process.env.TABLO_DEVICE) {
        return process.env.TABLO_DEVICE;
    } else {
        return undefined;
    }
}

/**
 * Server ID of the Tablo device to use if you have more than 1
 */
const TABLO_DEVICE = _confrim_device();

/**
 * Static Class for creating and converting Dates in JavaScript format and others.
 * 
 * @class 
 */
class JSDate {
    /**
     * Shortcut for ``New Date().GetTime()``
     * 
     * @static
     * @returns {number} Returns the stored time value in milliseconds since midnight, January 1, 1970 UTC.
     */
    static get ct() {
        return new Date().getTime();
    }

    /**
     * Get time as string. Used in Logger. Example: ``'2024.03.03-01.00.00AM'``
     * 
     * @static
     * @returns {string} `year.month.day-hours.minutes.seconds amOrPm`
     */
    static currentTime() {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const amOrPm = hours >= 12 ? 'PM' : 'AM';

        // Convert hours to 12-hour format
        hours = hours % 12 || 12;

        return `${year}.${month}.${day}-${hours}.${minutes}.${seconds}${amOrPm}`;
    }

    /**
     * RFC 1123 type date for headers
     * 
     * @static 
     * @param {string|number|Date|undefined} date
     * @returns {string}
     */
    static getRFC1123DateString(date = undefined) {
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthsOfYear = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                Logger.error("Date must be an instanceof new Date()");
                exit();
            }
        } else {
            date = new Date();
        };

        const dayOfWeek = daysOfWeek[date.getUTCDay()];
        const dayOfMonth = String(date.getUTCDate()).padStart(2, '0');
        const month = monthsOfYear[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        return `${dayOfWeek}, ${dayOfMonth} ${month} ${year} ${hours}:${minutes}:${seconds} GMT`;
    }

    /**
     * 
     * @param {number} days 
     * @returns {string[]}
     */
    static getDaysFromToday(days) {
        /**
         * 
         * @param {Date} date 
         * @returns 
         */
        const formatDate = (date) => {
            const year = date.getFullYear();

            const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based

            const day = String(date.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        };

        const dates = [];

        // Get today's date

        for (let i = 0; i < days; i++) {
            const curDate = new Date();

            curDate.setDate(curDate.getDate() + i);

            dates.push(formatDate(curDate));
        }

        // Return the dates
        return dates;
    }

    /**
     * 
     * @param {string | number} dateString 
     * @returns 
     */
    static getXMLDateString(dateString) {
        // Parse the ISO date string into a Date object
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            throw new Error('Invalid date string');
        }

        // Extract components from the Date object
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');

        // Format the date as YYYYMMDDHHMMSS
        const formattedDate = `${year}${month}${day}${hour}${minute}${second}`;

        // Calculate the timezone offset in minutes
        const timezoneOffsetMinutes = -date.getTimezoneOffset();

        // Convert the timezone offset to hours and minutes
        const timezoneHours = Math.floor(Math.abs(timezoneOffsetMinutes) / 60);
        const timezoneMinutes = Math.abs(timezoneOffsetMinutes) % 60;

        // Format the timezone as ±HHMM
        const timezoneSign = timezoneOffsetMinutes >= 0 ? '+' : '-';
        const formattedTimezone = `${timezoneSign}${String(timezoneHours).padStart(2, '0')}${String(timezoneMinutes).padStart(2, '0')}`;

        // Combine the formatted date and timezone
        return `${formattedDate} ${formattedTimezone}`;
    }

    /**
     * For formated date strings: ``'Thu, Feb 8, 2024, 07:09:20 AM'``
     * 
     * Mostly for transmissions header
     * 
     * @static
     * @param {Date|string|number|undefined} date - ``new Date()`` by default
     * @returns {string} Example ``'Thu, Feb 8, 2024, 07:09:20 AM'``
     */
    static humanReadable(date = undefined) {
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                Logger.error("Date must be an instanceof new Date()");
                exit();
            }
        } else {
            date = new Date();
        };

        return new Intl.DateTimeFormat('en-US', {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC',
            weekday: "short",
        }).format(date);
    }

    /**
     * Formats date for master data. Example: ``'2017-04-14 15:00:00'``
     * 
     * @static
     * @param {Date|string|number|undefined} date - ``new Date()`` by default
     * @returns {string} Example: ``'2017-04-14 15:00:00'``
     */
    static masterFormat(date) {
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                Logger.error("Date must be an instanceof new Date()");
                exit();
            }
        } else {
            date = new Date();
        };
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Get a time offset of supplied days from now. Great for editing existing time data or setting something to forever. 
     * 
     * Returns master data format string. Example: ``'2017-04-14 15:00:00'``
     * 
     * @static
     * @param {Date|string|number|undefined} date - Date as number, Date instance or string. Defaults to Current Time.
     * @param {number} days - offset of days from now
     * @returns {number} time as a number
     */
    static getDaysFromNumber(date, days) {
        if (days == undefined) {
            Logger.error("days offset must be set");
            exit();
        }
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                Logger.error("Date must be an instanceof new Date()");
                exit();
            }
        } else {
            date = new Date();
        };
        const date2 = new Date(date.getTime() + days * (24 * 60 * 60 * 1000));
        return date2.getTime();
    }

    /**
     * Get a time offset of supplied days from now. Great for editing existing time data or setting something to forever. 
     * 
     * Returns master data format string. Example: ``'2017-04-14 15:00:00'``
     * 
     * @static
     * @param {Date|string|number|undefined} date - Date as number, Date instance or string. Defaults to Current Time.
     * @param {number} days - offset of days from now
     * @returns {string} master data format string. Example: ``'2017-04-14 15:00:00'``
     */
    static getDaysFromString(date, days) {
        if (days == undefined) {
            Logger.error("Days offset must be set");
            exit();
        }
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                Logger.error("Date must be an instanceof new Date()");
                exit();
            }
        } else {
            date = new Date();
        };
        const date2 = new Date(date.getTime() + days * (24 * 60 * 60 * 1000));
        const year = date2.getFullYear();
        const month = String(date2.getMonth() + 1).padStart(2, '0');
        const day = String(date2.getDate()).padStart(2, '0');
        return `${year}-${month}-${day} 00:00:00`;
    }

    /**
     * Quickly get a time offset of d0 days from date. Great for editing existing time data or setting something to forever. 
     * 
     * Returns master data format string. Example: ``'2017-04-14 15:00:00'``
     * 
     * @static
     * @param {Date|string|number|undefined} date - Date as number, Date instance or string. Defaults to Current Time.
     * @returns {string} master data format string. Example: ``'2017-04-14 15:00:00'``
     */
    static get30DaysFromString(date) {
        return this.getDaysFromString(date, 30);
    }

    /**
     * Quickly get a time offset of 30 days from now. Great for editing existing time data or setting something to forever. 
     * 
     * Returns master data format string. Example: ``'2017-04-14 15:00:00'``
     * 
     * @static
     * @returns {string} master data format string. Example: ``'2017-04-14 15:00:00'``
     */
    static get30DaysFromNowString() {
        return this.getDaysFromString(new Date(), 30);
    }

    /**
     * Quickly get a time offset of 30 days from now. Great for editing existing time data or setting something to forever. 
     * 
     * @static
     * @returns {number} time as a number
     */
    static get30DaysFromNowNumber() {
        return this.getDaysFromNumber(new Date(), 30);
    }

    /**
     * Quickly get a time offset of 30 days from date. Great for editing existing time data or setting something to forever. 
     * 
     * @static
     * @param {Date|string|number|undefined} date - Date as number, Date instance or string. Defaults to Current Time.
     * @returns {number} time as a number
     */
    static get30DayFromNumber(date) {
        return this.getDaysFromNumber(date, 30);
    }

    /**
     * Get a time offset of supplied days from now. Great for editing existing time data or setting something to forever. 
     * 
     * @static
     * @param {number} days - offset of days from now
     * @returns {number} time as a number
     */
    static getDaysFromNowNumber(days) {
        return this.getDaysFromNumber(new Date(), days);
    }

    /**
     * Get a time offset of supplied days from now. Great for editing existing time data or setting something to forever. 
     * 
     * Returns master data format string. Example: ``'2017-04-14 15:00:00'``
     * 
     * @static
     * @param {number} days - offset of days from now
     * @returns {string} master data format string. Example: ``'2017-04-14 15:00:00'``
     */
    static getDaysFromNowString(days) {
        return this.getDaysFromString(new Date(), days);
    }
};

/**
 * Logger base class. Not to be used outside of ``Logger``
 * 
 * @class
 */
class _CustomLog {
    loc = "";
    constructor() {
        if (SAVE_LOG) {
            if (!fs.existsSync(path.join(DIR_NAME, `/logs`))) {
                fs.mkdirSync(path.join(DIR_NAME, `/logs`), { recursive: true });
            }
            this.loc = path.join(DIR_NAME, `/logs/${JSDate.currentTime()}-${LOG_LEVEL}.log`);
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

        if (SAVE_LOG) {
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

const _cl = new _CustomLog();

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
        const match = stackTrace.match(/\s*at .+ \((.*)\)/) ||
            stackTrace.match(/\s*at (.*)/);

        // Extract the file name, line number, and column number
        const fileName = match ? path.basename(match[1]) : null;
        console.log(`${fileName ? fileName : ""} -`, message.join(" "));
    }

    /**
     * Info log. Always logs and writes this.
     * 
     * No extra info.
     * 
     * @static
     * @param {any[]} message - Message to log.
     */
    static info(...message) {
        if (_LOG_LEVEL >= 0) {

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
        if (_LOG_LEVEL >= 1) {
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
            const match = stackTrace.match(/\s*at .+ \((.*)\)/) ||
                stackTrace.match(/\s*at (.*)/);

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
        if (_LOG_LEVEL >= 2) {
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
        if (_LOG_LEVEL >= 3) {

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
            const match = stackTrace.match(/\s*at .+ \((.*)\)/) ||
                stackTrace.match(/\s*at (.*)/);

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
        const match = stackTrace.match(/\s*at .+ \((.*)\)/) ||
            stackTrace.match(/\s*at (.*)/);

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

/**
 * A press any key to exit function.
 * 
 * @async
 */
async function exit() {
    // Enable keypress events on stdin
    keypress(process.stdin);

    console.log('Press any key to exit...');

    /**
     * Create a promise to handle key press
     * @returns {Promise<any>} Promise
     */
    function getKeyPress() {
        return new Promise(resolve => {
            var pressed = true;
            process.stdin.on('keypress', (_, key) => {
                if (pressed && key) {
                    pressed = false;
                    console.log("Exiting...");
                    setTimeout(() => {
                        process.exit(0);
                    }, 2000);
                }
            });

            // Set raw mode to capture all key events
            process.stdin.setRawMode(true);
            process.stdin.resume();
        });
    }

    // Wait for key press
    await getKeyPress();

    // Clean up keypress events
    process.stdin.setRawMode(false);
    process.stdin.pause();
};

/**
 * Ask for input based on question. Input can't be blank.
 * 
 * Example:
 * 
 * ```
 * input("What is your name?").then(answer=>{
 *      if(answer){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} question - Question to ask.
 * @param {boolean} isPassword - if the input needs to be masked
 * @returns {Promise<string>} Promise
 */
async function input(question, isPassword = false) {
    const questions = {
        message: question,
        required: true,
    };

    return new Promise((resolve, reject) => {
        try {
            if (isPassword) {
                password(questions).then(answer => {
                    resolve(answer);
                });
            }
            else {
                inputs(questions).then(answer => {
                    resolve(answer);
                });
            }
        } catch (error) {
            reject();
        }
    });
};

/**
 * Ask a yes / no question.
 * 
 * Example:
 * 
 * ```
 * ask("Continue?").then(answer=>{
 *      if(answer){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} question - Question to ask.
 * @returns {Promise<boolean>} Promise
 */
async function ask(question) {
    const questions = {
        type: 'confirm',
        message: question,
        defalt: false
    };

    return new Promise((resolve, reject) => {
        try {
            confirm(questions).then(answer => {
                resolve(answer);
            });
        } catch (error) {
            reject();
        }
    });
};

/**
 * An input of multi select checkboxes (multi select).
 * 
 * Example:
 * 
 * ```
 * const questions = [
 *    {
 *        value: 'Extra Cheese'
 *    },
 *    {
 *        value: 'Pepperoni'
 *    }
 * ]
 * select("What would you like on your pizza?", questions).then(answers=>{
 *      if(answers){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} title - Title of the selection.
 * @param {{value: string, disabled?: boolean | string, description?: string }[]} questions - Array of answers to select.
 * @returns {Promise<string[]>} Promise
 */
async function selects(title, questions) {

    const new_array_of_questions = questions.map((question) => {
        if (question.value == undefined) {
            return new Separator();
        } else {
            return question;
        }
    });

    const question = {
        message: title + "\n",
        choices: new_array_of_questions,
        required: true,
    };

    return new Promise((resolve, reject) => {
        try {
            checkbox(question).then(answer => {
                resolve(answer);
            });
        } catch (error) {
            reject();
        }
    });
};

/**
 * An input of a single select list (single selection).
 * 
 * Example:
 * 
 * ```
 * const questions = [
 *    {
 *        value: 'Extra Cheese'
 *    },
 *    {
 *        value: 'Pepperoni'
 *    }
 * ]
 * choose("What would you like on your pizza?", questions).then(answers=>{
 *      if(answers){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} title - Title of the selection.
 * @param {{value: string, disabled?: boolean | string, description?: string }[]} questions - Array of answers to select.
 * @returns {Promise<string>} Promise
 */
async function choose(title, questions) {

    const new_array_of_questions = questions.map((question) => {
        if (question.value == undefined) {
            return new Separator();
        } else {
            return question;
        }
    });

    const question = {
        message: title,
        choices: new_array_of_questions,
        required: true,
    };

    return new Promise((resolve, reject) => {
        try {
            select(question).then(answer => {
                resolve(answer);
            });
        } catch (error) {
            reject();
        }
    });
};

class Scheduler {
    runAt = new Date();
    interval = 0;
    task = async () => { };
    nextCheck = "";
    schedulerFile = "";
    label = "Default task"; // Update channel lineup
    /**
     * Sets a new scheduled time and task.
     * @param {string} schedulerFile - JSON file to write the date.
     * @param {string} label - The name of the task
     * @param {number} interval - How often the task should run in milliseconds
     * @param {() => Promise<void>} taskFn - The async task to run at the scheduled time.
     */
    constructor(schedulerFile, label, interval, taskFn) {

        this.interval = interval;

        this.schedulerFile = schedulerFile;

        if (!FS.fileExists(schedulerFile)) {
            this.nextCheck = JSDate.getRFC1123DateString();

            const newFile = {
                interval: this.interval,
                nextCheck: this.nextCheck
            };

            FS.writeJSON(newFile, schedulerFile);
        }
        else {
            const readFile = FS.readJSON(schedulerFile);

            this.interval = readFile.interval;

            this.nextCheck = readFile.nextCheck;
        }

        this.runAt = new Date(this.nextCheck);

        if (isNaN(this.runAt.getTime())) {
            Logger.error("Invalid Scheduler time string:", this.nextCheck);
            return;
        }

        this.label = label;

        this.task = taskFn;
    }

    async scheduleNextRun() {
        if (this.runAt.getTime() - JSDate.ct <= 0) {
            await this.runTask();
        }
        this.timeout = setInterval(async () => {
            if (this.runAt.getTime() - JSDate.ct <= 0) {
                await this.runTask();
            }
        }, 24 * 60 * 60 * 1000); // once a day
        return;
    }

    async runTask() {
        try {
            await this.task();

            this.nextCheck = JSDate.getRFC1123DateString(JSDate.ct + this.interval);

            this.runAt = new Date(this.nextCheck);

            // write file;
            const newFile = {
                interval: this.interval,
                nextCheck: this.nextCheck
            };

            FS.writeJSON(newFile, this.schedulerFile);

            Logger.info(`${this.label} finished running. Next run scheduled for ${this.nextCheck}`);

            return;
        } catch (e) {
            Logger.error(`${this.label} failed:`, e);

            return;
        }
    }

    /**
     * Cancels the scheduled task.
     */
    cancel() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }
}

/**
 * File size short hand. Example: ``1.5kb``.
 * 
 * @param {number} bytes - Size
 * @returns {string} formatted
 */
function _formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + 'kb';
    } else if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + 'mb';
    } else {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'gb';
    }
}

/**
 * Loading bar function.
 * 
 * @param {number} totalSteps - total pos
 * @param {number} currentStep - current pos
 * @param {boolean|undefined} withSize - shows size of file as well
 * @returns {number}
 */
function _consoleLoadingBar(totalSteps, currentStep, withSize = false) {
    var barLength = 40;
    // Calculate the percentage completed
    const percentage = (currentStep / totalSteps) * 100;

    // Calculate the number of bars to display
    const bars = Math.floor((barLength * currentStep) / totalSteps);

    // Create the loading bar string
    const loadingBar = '[' + '='.repeat(bars) + '>'.repeat(bars < barLength ? 1 : 0) + ' '.repeat(barLength - bars) + ']';

    // Print the loading bar to the console
    process.stdout.clearLine(0); // Clear the previous line
    process.stdout.cursorTo(0); // Move the cursor to the beginning of the line
    process.stdout.write(
        `${C_HEX.green}${loadingBar}${C_HEX.reset} - ${percentage.toFixed(2)}%` +
        (withSize
            ? ` of ${_formatFileSize(totalSteps)} / ${_formatFileSize(currentStep)}`
            : ` - ${currentStep} of ${totalSteps}`)
    );
    return 1;
};

/**
 * Check if a directory exist.
 * 
 * @param {string} dir - Path to directory.
 * @returns {boolean} if exists
 */
function _directoryExists(dir) {
    if (fs.existsSync(dir)) {
        return true;
    };
    return false;
};

/**
 * Check if a file exist.
 * 
 * @param {string} filePath - Path to file to check.
 * @returns {boolean} if exists
 */
function _fileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;  // File exists
    } catch (error) {
        // @ts-ignore
        if (error.code === 'ENOENT') {
            return false;  // File does not exist
        } else {
            Logger.error(error); // Other errors
            return false;
        }
    }
};

/**
 * Creates a directory.
 * 
 * @param {string} dir - Path to directory.
 */
function _makeDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    };
};

/**
 * For reading and returning all local file paths in a directory
 * 
 * @param {string} dir - directory to check
 * @param {string} current_folder - Current folder
 * @param {{str:string}} current_string - Current string object
 * @param {string[]} current_array - array of local file paths
 */
function _increase_path(dir, current_folder, current_string, current_array) {
    var check = path.join(dir, current_folder);
    if (fs.statSync(check).isDirectory()) {
        current_string.str += current_folder + "/";
        const folders = fs.readdirSync(check);
        for (const key in folders) {
            if (Object.prototype.hasOwnProperty.call(folders, key)) {
                const context = folders[key];
                _increase_path(check, context, current_string, current_array);
            }
        }
    } else {
        current_array.push(current_string.str + current_folder);
    }
}

/**
 * Ensures that a given path exists as a file or directory.
 * 
 * Will write data if passed.
 * 
 * @param {string} targetPath - The path to check or create.
 * @param {any?} fileData - Data for the file
 */
function _ensurePathExists(targetPath, fileData) {
    const isFile = !!path.extname(targetPath);
    try {
        if (fs.existsSync(targetPath)) {
            const stats = fs.statSync(targetPath);
            // Path already exists as file, but we want folder
            if (!isFile && stats.isFile()) {
                fs.mkdirSync(targetPath, { recursive: true });
                return;
            }
        }

        // Path does not exist, create it
        if (!isFile) {
            // targetPath is a folder so create it
            fs.mkdirSync(targetPath, { recursive: true });
        } else if (isFile) {
            // targetPath is a file so make sure folder path is created
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (fileData) {
                // writes file data if supplied
                fs.writeFileSync(targetPath, fileData);
            }
        }
    } catch (err) {
        Logger.error("Error checking path to write data.");
        Logger.error(targetPath);
        Logger.error(err)
    }
}

/**
 * General file system static class.
 * 
 * For all file based operations.
 * @class
 */
class FS {

    /**
     * Test if a directory exists.
     * 
     * @static
     * @param {string} srcPath - Path to test. Do NOT include a file name.
     * @returns {boolean} if directory exists.
     */
    static directoryExists(srcPath) {
        return _directoryExists(srcPath);
    };

    /**
     * Test if a file directory exists.
     * 
     * @static
     * @param {string} srcPath - Full path to file including the file name.
     * @returns {boolean} if file exists.
     */
    static fileExists(srcPath) {
        return _fileExists(srcPath);
    };

    /**
     * Creates a path if one doesn't exist.
     * 
     * @static
     * @param {string} srcPath - Path to create. Do NOT include a file name.
     */
    static createDirectory(srcPath) {
        if (!_directoryExists(srcPath)) {
            _makeDirectory(srcPath);
        }
    };

    /**
     * Returns a list of all folders inside the given folder path.
     * 
     * Note: Not full path, just folder names.
     * 
     * ```js
     * [
     *   'folder1',
     *   'folder2',
     *   // etc
     * ]
     * ```
     * 
     * @static
     * @param {string} folderPath - The path of the folder to list subfolders from.
     * @param {boolean} fullPath - Returns full path and not just the folder names.
     * @returns {string[]} - An array of folder names inside the given folder.
     */
    static readDirectoryFolders(folderPath, fullPath = false) {
        try {
            const file = fs.readdirSync(folderPath);
            if (!fullPath) {
                return file
                    .filter(item => {
                        const itemPath = path.join(folderPath, item);
                        return fs.statSync(itemPath).isDirectory();
                    });
            } else {
                /**
                 * @type {string[]} 
                 */
                const list = [];
                file.forEach(item => {
                    const itemPath = path.join(folderPath, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        list.push(itemPath);
                    }
                });
                return list;
            }
        } catch (error) {
            // @ts-ignore
            Logger.error(`Error reading the folder: ${error.message}`);
            return [];
        }
    };

    /**
     * Returns a list of all files inside the given folder path.
     * 
     * ```js
     * [
     *  'file1.txt',
     *  'file2.txt',
     *  // etc
     * ]
     * ```
     * 
     * @static
     * @param {string} folderPath - The path of the folder to list files from.
     * @param {boolean} fullPath - Returns full path and not just the file names.
     * @param {string|undefined} only_type - Only return subfolders with this extension (include period).
     * @returns {string[]} - An array of file names inside the given folder.
     */
    static readDirectoryFiles(folderPath, fullPath = false, only_type = undefined) {
        try {
            const file = fs.readdirSync(folderPath);
            if (!fullPath) {
                return file
                    .filter(item => {
                        const itemPath = path.join(folderPath, item);
                        const Ext = path.extname(itemPath);
                        if (only_type) {
                            return fs.statSync(itemPath).isFile() && Ext == only_type;
                        } else {
                            return fs.statSync(itemPath).isFile();
                        }
                    });
            } else {
                /**
                 * @type {string[]} 
                 */
                const list = [];
                file.forEach(item => {
                    const itemPath = path.join(folderPath, item);
                    const Ext = path.extname(itemPath);
                    if (only_type) {
                        if (Ext == only_type && fs.statSync(itemPath).isFile()) {
                            list.push(itemPath);
                        }
                    } else
                        if (fs.statSync(itemPath).isFile()) {
                            list.push(itemPath);
                        }
                });
                return list;
            }
        } catch (error) {
            // @ts-ignore
            Logger.error(`Error reading the folder: ${error.message}`);
            return [];
        }
    };

    /**
     * Returns all files with local path from supplied directory.
     * 
     * Note: Relative path to supplied directory.
     * 
     * ```js
     * [
     *   'folder1/file1.txt',
     *   'folder1/file2.txt',
     *   'folder2/file1.txt',
     *   'folder2/file2.txt',
     *   // etc
     * ]
     * ```
     * 
     * @static
     * @param {string} directory directory to return all file paths in
     * @returns {string[]} path to files
     */
    static readDirectoryAndFiles(directory) {
        const starting_folder = fs.readdirSync(directory);
        /**
         * @type {string[]} 
         */
        const finished_array = [];
        for (const key in starting_folder) {
            if (Object.prototype.hasOwnProperty.call(starting_folder, key)) {
                const folder = starting_folder[key];
                const str = { str: "" };
                _increase_path(directory, folder, str, finished_array);
            }
        }
        return finished_array;
    };

    /**
     * Deletes files in the specified directory that are NOT listed in the filenames array.
     *
     * @param {string} directory - The directory path where the files are located.
     * @param {string[]} filenames - An array of filenames to keep.
     */
    static deleteUnlistedFiles(directory, filenames) {
        // Read the contents of the directory
        fs.readdir(directory, (err, files) => {
            if (err) {
                Logger.error(`Error reading directory: ${err}`);
                return;
            }

            // Filter out the files that are not in the filenames array
            const filesToDelete = files.filter(file => !filenames.includes(file));

            // Delete those files
            filesToDelete.forEach(file => {
                const filePath = path.join(directory, file);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        Logger.error(`Error deleting file ${filePath}: ${err}`);
                    }
                });
            });
        });
    }

    /**
     * Writes a file. Will create the directory if it doesn't exist.
     * 
     * @static
     * @param {Buffer|string|object} data - File data
     * @param {string} srcPath - Full path to file including the file name.
     * @throws {Error} if data is not writable.
     */
    static writeFile(data, srcPath) {
        ;
        // stringify if needed
        if (typeof data == "object" && !(data instanceof Buffer)) {
            data = JSON.stringify(data, null, 2);
        }
        if (data instanceof Buffer || typeof data == "string") {
            _ensurePathExists(srcPath, data);
        } else {
            Logger.error("Data supplied to be written was not in a JSON format");
            Logger.error(srcPath);
        }
    };

    /**
     * Loads a file and returns the ``Buffer``.
     * 
     * @static
     * @param {string} srcPath - Full path to file including the file name.
     * @returns {Buffer} Buffer of data
     * @throws {Error} if file doesn't exist
     */
    static readFile(srcPath) {
        const dir = path.dirname(srcPath);
        if (!_directoryExists(dir)) {
            Logger.error("Can not find folder to file being read: " + srcPath);
            exit();
        }
        if (!_fileExists(srcPath)) {
            Logger.error("Can not find file being read: " + srcPath);
            exit();
        }
        return fs.readFileSync(srcPath);
    };

    /**
     * Loads a JSON file and returns the object data.
     * 
     * @static
     * @param {string} srcPath - Full path to file including the file name.
     * @returns {any} data
     * @throws {Error} if file doesn't exist
     */
    static readJSON(srcPath) {
        const dir = path.dirname(srcPath);
        if (!_directoryExists(dir)) {
            Logger.error("Can not find folder to file being read: " + srcPath);
            exit();
            return;
        }
        if (!_fileExists(srcPath)) {
            Logger.error("Can not find file being read: " + srcPath);
            exit();
            return;
        }
        try {
            const buf = fs.readFileSync(srcPath);
            return JSON.parse(buf.toString());
        } catch (error) {
            Logger.error("Could not parse JSON data: " + srcPath);
            return {};
        }
    };

    /**
     * Writes a file. Will create the directory if it doesn't exist.
     * 
     * @static
     * @param {object|string|Buffer} data - Data is save (if Buffer or string than assumes it's been stringify)
     * @param {string} srcPath - Full path to file including the file name with .json ext.
     * @throws {Error} if data is not writable.
     */
    static writeJSON(data, srcPath) {
        this.writeFile(data, srcPath);
    };

    /**
     * Loading bar function. Use on each update
     * 
     * When completed, end with:
     * 
     * ```javascript
     * process.stdout.write('\n');
     * 
     * ```
     * 
     * @static
     * @param {number} totalSteps - total amount
     * @param {number} currentStep - current amount
     * @param {boolean|undefined} witchSize - Converts amounts to file size
     * @returns {number}
     */
    static loadingBar(totalSteps, currentStep, witchSize = false) {
        return _consoleLoadingBar(totalSteps, currentStep, witchSize);
    };
};

/**
 * new MersenneTwister().
 * 
 * Can be seeded with a 4 byte Buffer or number.
 * 
 * Use ``random_int()`` for random number on [0,0xffffffff]-interval.
 * 
 * @class
 * @param {Buffer|number|undefined} seed - Can be seeded
 */
class MersenneTwister {
    /**
     * @constructor
     * @param {Buffer|number|undefined} seed - Seed data, can be undefined, number or Buffer with a length of 4
     * If undefined, seed is the current time
     * If number, it is used as the seed
     * If Buffer, the first 4 bytes are used as the seed
     */
    constructor(seed = undefined) {
        /* Period parameters */
        this.N = 624;
        this.M = 397;
        this.MATRIX_A = 0x9908b0df; /* constant vector a */
        this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
        this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

        this.mt = new Array(this.N); /* the array for the state vector */
        this.mti = this.N + 1; /* mti==N+1 means mt[N] is not initialized */

        if (typeof seed == "number") {
            this._init_seed(seed);
        } else if (seed instanceof Buffer) {
            const array = Array();
            for (let i = 0; i < 4; i++) {
                array.push(seed[i]);
            }
            this._init_by_array(array, 4);
        } else {
            this._init_seed(new Date().getTime());
        }
    }

    /**
     * initializes mt[N] with a seed
     * @param {number} s - seed value
     * @returns {void}
     */
    _init_seed(s) {
        this.mt[0] = s >>> 0;
        for (this.mti = 1; this.mti < this.N; this.mti++) {
            s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
            this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253)
                + this.mti;
            /* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
            /* In the previous versions, MSBs of the seed affect   */
            /* only MSBs of the array mt[].                        */
            /* 2002/01/09 modified by Makoto Matsumoto             */
            this.mt[this.mti] >>>= 0;
            /* for >32 bit machines */
        }
    }

    /**
     * initialize by an array with array-length
     * 
     * @param {Array<number>} init_key - array for initializing keys
     * @param {number} key_length - is its length
     */
    _init_by_array(init_key, key_length) {
        var i, j, k;
        this._init_seed(19650218);
        i = 1; j = 0;
        k = (this.N > key_length ? this.N : key_length);
        for (; k; k--) {
            var s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525)))
                + init_key[j] + j; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++; j++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
            if (j >= key_length) j = 0;
        }
        for (k = this.N - 1; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941))
                - i; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
        }

        this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */
    }

    /**
     * generates a random number on [0,0xffffffff]-interval 
     * 
     * @returns {number} number
     */
    random_int() {
        var y;
        var mag01 = new Array(0x0, this.MATRIX_A);
        /* mag01[x] = x * MATRIX_A  for x=0,1 */
        if (this.mti >= this.N) { /* generate N words at one time */
            var kk;

            if (this.mti == this.N + 1) /* if init_seed() has not been called, */
                this._init_seed(5489); /* a default initial seed is used */

            for (kk = 0; kk < this.N - this.M; kk++) {
                y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            for (; kk < this.N - 1; kk++) {
                y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            y = (this.mt[this.N - 1] & this.UPPER_MASK) | (this.mt[0] & this.LOWER_MASK);
            this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

            this.mti = 0;
        }

        y = this.mt[this.mti++];

        /* Tempering */
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);

        return y >>> 0;
    }

    /**
     * generates a random number on [0,0x7fffffff]-interval 
     * 
     * @returns {number} number
     */
    random_int31() {
        return (this.random_int() >>> 1);
    }

    /**
     * generates a random number on [0,1]-real-interval
     * 
     * @returns {number} number
     */
    random_incl() {
        return this.random_int() * (1.0 / 4294967295.0);
        /* divided by 2^32-1 */
    }

    /**
     * generates a random number on [0,1)-real-interval
     * 
     * @returns {number} number
     */
    random() {
        return this.random_int() * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    }

    /**
     * generates a random number on (0,1)-real-interva
     * 
     * @returns {number} number
     */
    random_excl() {
        return (this.random_int() + 0.5) * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    }

    /**
     * generates a random number on [0,1) with 53-bit resolution
     * 
     * @returns {number} number
     */
    random_long() {
        var a = this.random_int() >>> 5, b = this.random_int() >>> 6;
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    }
};

/**
 * For Tablo device signing
 * @param {string} method - POST, GET, PUT
 * @param {string} url - end directory url without params
 * @param {string} msg - content of message, use "" for none.
 * @param {string} date - Human readable string
 */
function makeDeviceAuth(method, url, msg, date) {
    if (msg != "") {
        const MD5 = createHash("md5").update(msg);
        msg = MD5.digest('hex').toLowerCase();
    }
    const full_str = method + "\n" + url + "\n" + msg + "\n" + date;
    const key = process.env.HashKey == undefined ? "6l8jU5N43cEilqItmT3U2M2PFM3qPziilXqau9ys" : process.env.HashKey;
    const part2 = createHmac("md5", key).update(full_str);
    const device = process.env.DeviceKey == undefined ? "ljpg6ZkwShVv8aI12E2LP55Ep8vq1uYDPvX0DdTB" : process.env.DeviceKey;
    return "tablo:" + device + ":" + part2.digest('hex').toLowerCase();
}

/**
 * Tablo device request
 * 
 * @param {string} method 
 * @param {string} host 
 * @param {string} path 
 * @param {string} msg 
 * @param {{"Content-Type"?:string,Connection?:string,Date?:string,Accept?:string,"User-Agent"?:string,"Content-Length"?:string,Authorization?:string}} headers 
 * @param {Record<string, string>} params 
 * @returns {Promise<Buffer>}
 */
async function makeTabloRequest(method, host, path, msg = "", headers = {}, params = {}) {

    const url = host + path;
    const baseUrl = new URL(path, host);
    const searchParams = new URLSearchParams(params);
    baseUrl.search = searchParams.toString();
    const date = JSDate.getRFC1123DateString();
    headers["Connection"] = "keep-alive";
    headers["Date"] = date;
    headers["Accept"] = "*/*";
    headers["User-Agent"] = "Tablo-FAST/1.7.0 (Mobile; iPhone; iOS 18.4)";
    const auth = makeDeviceAuth(method, path, msg, date);
    var body;
    if (method == "POST" && msg != "") {
        body = Buffer.from(msg);
        headers["Content-Length"] = `${body.length}`;
    }
    headers["Authorization"] = auth;
    return await fetch(
        baseUrl.toString(),
        {
            method: method,
            headers: headers,
            body: method == "POST" ? body : undefined
        }
    ).then(async response => {
        if (response) {
            return Buffer.from(await response.arrayBuffer())
        }
        else {
            Logger.error(`\x1b[31m[Error]\x1b[0m: Fetching device ${url}`);
            return Buffer.alloc(0);
        }
    });
}

/**
 * 
 * 
 * @param {string} method 
 * @param {string} host 
 * @param {string} path 
 * @param {string} UUID
 * @returns 
 */
async function reqTabloDevice(method, host, path, UUID) {
    const headers = {};
    /**
     * @type {any}
     */
    const dataIn = {};
    if (method == "POST") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        dataIn["bandwidth"] = null;
        dataIn["device_id"] = UUID;
        dataIn["extra"] = {
            "deviceId": "00000000-0000-0000-0000-000000000000",
            "deviceOS": "iOS",
            "deviceMake": "Apple",
            "height": 1080,
            "deviceOSVersion": "16.6",
            "width": 1920,
            "lang": "en_US",
            "limitedAdTracking": 1,
            "deviceModel": "iPhone10,1"
        };
        dataIn["platform"] = "ios";
    }
    return await makeTabloRequest(method, host, path, method == "POST" ? JSON.stringify(dataIn) : "", headers);
}

class Encryption {
    constructor() { }
    /**
     * 
     * @param {string} creds - stringified creds
     * @returns {Buffer}
     */
    static crypt(creds) {
        const RSA = process.env.RSA == undefined ?
            "30818902818100B507AAAC6B6B1BA5CE02B8512381159ECFD9CD32D6EEADCAFF459EA7E2210819C2D915F437E30871DDA190F19B8898038E1E7863A21699CDA5BC6C84C49D935AFAFFE1D2F16B0C662DC8941D8751FB7A36AC22F5980EDF92FCF7756FC6FCFD967A73303C7CD7030C681799C18E0A2F2D2B69C9F7BD8ADE05731BB179F354F0E90203010001" :
            process.env.RSA;
        const buff = Buffer.from(RSA, "hex");
        const keyBuff = Buffer.alloc(32, 0);
        for (let i = 0; i < buff.length / 4; i++) {
            const el1 = buff.readUInt32LE(i * 4);
            const inner = i % (keyBuff.length / 4);
            const num = keyBuff.readInt32LE(inner * 4);
            keyBuff.writeInt32LE(num ^ el1, inner * 4);
        }
        const setup = new MersenneTwister();
        const seed = setup.random_int();
        const seedBuff = Buffer.alloc(4);
        seedBuff.writeUInt32LE(seed);
        const mt = new MersenneTwister(seed ^ 0xffffffff);
        const pull = mt.random_int();
        const amount = (pull & 15) + 1;
        for (let i = 0; i < amount; i++) mt.random_int();
        const ivBuff = Buffer.alloc(16, 0);
        for (let i = 0; i < (16 / 4); i++) ivBuff.writeUInt32LE(mt.random_int(), i * 4);
        const cipher = createCipheriv("aes-256-cbc", keyBuff, ivBuff);
        cipher.setAutoPadding(true);
        cipher.write(creds);
        cipher.end();
        const encrypted = Buffer.concat([seedBuff, cipher.read()]);
        return encrypted;
    }

    /**
     * Check data with 0x7b
     * @param {Buffer} creds - file buffer of creds
     * @returns {Buffer}
     */
    static decrypt(creds) {
        const RSA = process.env.RSA == undefined ?
            "30818902818100B507AAAC6B6B1BA5CE02B8512381159ECFD9CD32D6EEADCAFF459EA7E2210819C2D915F437E30871DDA190F19B8898038E1E7863A21699CDA5BC6C84C49D935AFAFFE1D2F16B0C662DC8941D8751FB7A36AC22F5980EDF92FCF7756FC6FCFD967A73303C7CD7030C681799C18E0A2F2D2B69C9F7BD8ADE05731BB179F354F0E90203010001" :
            process.env.RSA;
        const buff = Buffer.from(RSA, "hex");
        const keyBuff = Buffer.alloc(32, 0);
        for (let i = 0; i < buff.length / 4; i++) {
            const el1 = buff.readUInt32LE(i * 4);
            const inner = i % (keyBuff.length / 4);
            const num = keyBuff.readInt32LE(inner * 4);
            keyBuff.writeInt32LE(num ^ el1, inner * 4);
        }
        const seed = creds.readUInt32LE();
        const mt = new MersenneTwister(seed ^ 0xffffffff);
        const pull = mt.random_int();
        const amount = (pull & 15) + 1;
        for (let i = 0; i < amount; i++) mt.random_int();
        const ivBuff = Buffer.alloc(16, 0);
        for (let i = 0; i < (16 / 4); i++) ivBuff.writeUInt32LE(mt.random_int(), i * 4);
        const cipher = createDecipheriv("aes-256-cbc", keyBuff, ivBuff);
        cipher.setAutoPadding(true);
        cipher.write(creds.subarray(4, creds.length));
        cipher.end();
        return cipher.read();
    }
}

/**
 * 
 * @param {string} method 
 * @param {string} hostname 
 * @param {string} path 
 *  @param {any} headers 
 * @param {string|Buffer} data 
 * @returns {Promise<string>}
 */
async function makeHTTPSRequest(method, hostname, path, headers, data = "") {
    return new Promise((resolve, reject) => {
        // Convert the data
        if (typeof data == "string") {
            data = Buffer.from(data);
        }
        else if (!(data instanceof Buffer)) {
            data = Buffer.from(JSON.stringify(data));
        }
        headers['Content-Length'] = Buffer.byteLength(data);

        // Define the options for the HTTPS request
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: method,
            headers: headers
        };

        // Create the request
        const req = https.request(options, (res) => {

            let dataIn = '';

            // A chunk of data has been received.
            res.on('data', (chunk) => {
                dataIn += chunk;
            });

            // The whole response has been received. Parse and resolve the result.
            res.on('end', () => {
                try {
                    resolve(dataIn);
                } catch (parseError) {
                    // @ts-ignore
                    reject(new Error(`Failed to parse response: ${parseError.message}`));
                }
            });
        });

        // Handle request errors
        req.on('error', (error) => {
            reject(error);
        });

        if (method == "POST") {
            // Write data to request body
            req.write(data);
        }

        // End the request
        req.end();
    });
}

/**
 * Gets host name for UUID
 * 
 * @returns {string} string
 */
function get_machine_hostname() {
    // Check if the code is running in a Node.js environment
    if (typeof process !== 'undefined' && process.release.name === 'node') {
        return os.hostname();
    }
    else {
        // Handle other environments or defaults
        return 'Unknwn';
    }
};

/**
 * Camps number between 1 and 5.
 * 
 * If undefined returns 4 for UUID.
 * 
 * @param {number} number number
 * @returns {number} number
 */
function camp(number) {
    if (number < 1) {
        return 1;
    }
    else if (number > 5) {
        return 5;
    }
    else if (number == undefined) {
        return 4;
    }
    else {
        return number;
    }
}

/**
 * For converting UUIDs strings to buffer.
 * 
 * @param {string} hexString hex string.
 * @returns {Buffer} buffer
 */
function _hex_string_to_Buffer(hexString) {
    hexString = hexString.replace(/-/g, "");
    // Check if the hex string has an odd length, and pad it with a leading "0" if needed.
    if (hexString.length % 2 !== 0) {
        hexString = "0" + hexString;
    }
    // Create a Buffer of the correct length.
    const buffer = Buffer.alloc(hexString.length / 2);
    // Parse the hex string and populate the Uint8Array.
    for (let i = 0; i < hexString.length; i += 2) {
        const byte = parseInt(hexString.substr(i, 2), 16);
        buffer[i / 2] = byte;
    }
    return buffer;
};

/**
 * Generates a UUID as Uint8Array, Buffer or Hex string (default).
 * 
 * @param {number|undefined} version - UUID version 1-5 (default 4)
 * @param {{seed?:undefined|Buffer,mac?:undefined|Buffer}|undefined} options - Object with asBuffer, asArray or asHex as true (default is asHex). If seeding is needed, use ``{seed: seed}``.If a mac ID is needed., use ``{mac: mac}``. Must be UInt8Array or Buffer of 16 bytes.
 * @param {boolean} asBuffer - to return buffer
 * @returns {string|Buffer} string
 */
function UUID(version = 4, options = {}, asBuffer = false) {
    /**
     * @type {Uint8Array|Buffer}
     */
    var buff;
    const seed = options && options.seed;
    const mac = options && options.mac;
    const seedIs8Array = seed instanceof Uint8Array;
    const seedIsBuff = seed instanceof Buffer;
    const seedEither = seedIsBuff || seedIs8Array;
    if (seed && seedEither) {
        if (seed.length < 16) {
            console.log("UUID Seed array must be at least 16 bytes");
        }
        else {
            buff = seed;
        }
    }
    else {
        const random_mt = new MersenneTwister();
        buff = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            buff[i] = random_mt.random_int();
        }
    }
    const macIs8Array = mac instanceof Uint8Array;
    const macIsBuff = mac instanceof Buffer;
    const macEither = macIsBuff || macIs8Array;
    if (mac != undefined) {
        if (mac && !macEither) {
            console.log("UUID Mac array must Uint8Array or Buffer");
        }
        if (mac.length != 6) {
            console.log("UUID Mac array must be at least 6 bytes");
        }
    }
    var ver = version != undefined ? camp(version) : 4;
    var output = "00000000-0000-0000-0000-000000000000";
    switch (ver) {
        case 1:
        case 2:
        case 3:
        case 5:
            var fakeMacBytes = new Uint8Array(6);
            if (mac != undefined) {
                // @ts-ignore
                fakeMacBytes = mac;
            }
            else {
                var fakeMac = get_machine_hostname() || "1234";
                var string_add = "\0";
                if (fakeMac.length < 6) {
                    for (let i = fakeMac.length; i < 6; i++) {
                        fakeMac += string_add;
                    }
                }
                fakeMacBytes = new TextEncoder().encode(fakeMac.slice(0, 6));
            }
            var uuidTemplate = `llllllll-mmmm-${ver}hhh-yxxx-zzzzzzzzzzzz`;
            var number = 0;
            var numbernib = 0;
            var macnumber = 0;
            var macnnib = 0;
            output = uuidTemplate.replace(/[lmhxyz]/g, function (c) {
                var r = buff[number] & 0xFF;
                var v = (r & 0x0F);
                switch (c) {
                    case "l":
                        if (numbernib == 0) {
                            v = r >>> 4;
                            numbernib += 1;
                        }
                        else {
                            v = r & 0xF;
                            number += 1;
                            numbernib = 0;
                        }
                        break;
                    case "m":
                        if (numbernib == 0) {
                            v = r >>> 4;
                            numbernib += 1;
                        }
                        else {
                            v = r & 0xF;
                            number += 1;
                            numbernib = 0;
                        }
                        break;
                    case "h":
                        if (numbernib == 0) {
                            v = r >>> 4;
                            numbernib += 1;
                        }
                        else {
                            v = r & 0xF;
                            number += 1;
                            numbernib = 0;
                        }
                        break;
                    case "x":
                        if (numbernib == 0) {
                            v = r >>> 4;
                            numbernib += 1;
                        }
                        else {
                            v = r & 0xF;
                            number += 1;
                            numbernib = 0;
                        }
                        break;
                    case "z":
                        r = fakeMacBytes[macnumber] & 0xff;
                        if (macnnib == 0) {
                            v = r >>> 4;
                            macnnib += 1;
                        }
                        else {
                            v = r & 0xF;
                            macnumber += 1;
                            macnnib = 0;
                        }
                        break;
                    case "y":
                        if (numbernib == 0) {
                            v = ((r >>> 4) & 0x3 | 0x8);
                            numbernib += 1;
                        }
                        else {
                            v = ((r & 0xF) & 0x3 | 0x8);
                            number += 1;
                            numbernib = 0;
                        }
                        break;
                    default:
                        if (numbernib == 0) {
                            v = r >>> 4;
                            numbernib += 1;
                        }
                        else {
                            v = r & 0xF;
                            number += 1;
                            numbernib = 0;
                        }
                        break;
                }
                return v.toString(16);
            });
            break;
        case 4:
            number = 0;
            numbernib = 0;
            uuidTemplate = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
            output = uuidTemplate.replace(/[xy]/g, function (c) {
                var r = buff[number] & 0xFF;
                if (numbernib == 0) {
                    r = r >>> 4;
                    numbernib += 1;
                }
                else {
                    r = r & 0xF;
                    number += 1;
                    numbernib = 0;
                }
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            break;
        default:
            break;
    }
    if (asBuffer) {
        return _hex_string_to_Buffer(output);
    }
    return output;
};

module.exports = {
    Logger,
    Scheduler,
    JSDate,
    FS,
    Encryption,

    C_HEX,
    ARGV,
    PORT,
    LINEUP_UPDATE_INTERVAL,
    INCLUDE_PSEUDOTV_GUIDE,
    CREATE_XML,
    GUIDE_DAYS,
    DIR_NAME,
    SERVER_URL,
    NAME,
    DEVICE_ID,
    TABLO_DEVICE,
    USER_NAME,
    USER_PASS,
    AUTO_PROFILE,
    VERSION,

    makeHTTPSRequest,
    reqTabloDevice,
    UUID,

    exit,
    input,
    choose
};