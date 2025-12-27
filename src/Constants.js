// @ts-check
require('dotenv').config();
const pack = require('../package.json');
const { Command } = require('commander');
const path = require('path');
const os = require('os');

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
    .addHelpText(`beforeAll`,            "Use the .env file to set options")
    .option('-c, --creds',               'Force creation of new creds file.')
    .option('-l, --lineup',              'Force creation of a fresh channel lineup file.')

    .option('-n, --name <string>',       'Name of the device that shows up in Plex. (overides .env file)')
    .option('-f, --id <string>',         'Fake ID of the device for when you have more than one device on the network. (overides .env file)')
    .option('-p, --port <string>',       'Overide the port. (overides .env file)')
    .option('-i, --interval <number>',   'How often the app rechecks the server for the channel lineup in days. (overides .env file)')
    .option('-x, --xml <boolean>',       'If you want to create an xml guide for the channels from Tablo\'s data instead of Plex. (overides .env file)')
    .option('-d, --days <number>',       'The amount of days the guide will populate (overides .env file)')
    .option('-s, --pseudo <boolean>',    'Include the guide data with your guide as long as it\'s at \/.pseudotv\/xmltv.xml (overides .env file)')
    .option('-g, --level <boolean>',     'Logger level. (overides .env file)')
    .option('-k, --log <boolean>',       'If you want to create a log file of all console output. (overides .env file)')
    .option('-o, --outdir <string>',     'Overide the output directory. Default is excution directory (overides .env file)')
    .option('-v, --device <string>',     'Server ID of the Tablo device to use if you have more than 1. (overides .env file)')
    .option('-u, --user <string>',       'Username to use for when creds.bin isn\'t present. (Note: will auto select profile)')
    .option('-w, --pass <string>',       'Password to use for when creds.bin isn\'t present. (Note: will auto select profile)')
    .option('-a, --ip_address <string>', 'Set the IP Address of Tablo2Plex add statically. (overides .env file)')
    .option(`-e, --guide <number>`,      'How often to update your XML guide data in hours, default once a day. (overides .env file)')
    ;

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
    if (ARGV.outdir) {
        return ARGV.outdir;
    } else if (process.env.OUT_DIR) {
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
 * confirms username to use, will prompt otherwise
 * 
 * @returns {string|undefined} port
 */
function _confirm_username() {
    if (ARGV.user) {
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
const USER_NAME = _confirm_username();

/**
 * confirms password to use, will prompt otherwise
 * 
 * @returns {string|undefined} port
 */
function _confirm_password() {
    if (ARGV.pass) {
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
const USER_PASS = _confirm_password();

/**
 * For auto selection a profile.
 */
const AUTO_PROFILE = USER_NAME != undefined ? true : false;

/**
 * For confirming log level for Logger.
 * 
 * @returns {string} string
 */
function _confirm_log_type() {
    var level;
    if (ARGV.level) {
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
 * Log level string for server logging.
 */
const LOG_TYPE = _confirm_log_type();

/**
 * For confirming ffmpeg log level.
 * 
 * @returns {string} string
 */
function _confirm_ffmpeg_log_level() {
    var level;
    if (ARGV.level) {
        level = ARGV.level;
    } else {
        level = process.env.LOG_LEVEL;
    }
    switch (level) {
        case "debug":
            return "debug";
        case "warn":
            return "warning";
        case "error":
            return "panic";
        case "info":
            return "info";
        default:
            return "panic";
    }
};

/**
 * Log level for ffmpeg.
 */
const FFMPEG_LOG_LEVEL = _confirm_ffmpeg_log_level();

/** 
 * Master function for finding machine IP address.
 * 
 * @returns {string} example ``'127.0.0.1'``
 */
function _get_local_IPv4_address() {
    if (ARGV.ip_address) {
        return ARGV.ip_address;
        //check env
    } else if (process.env.IP_ADDRESS) {
        return process.env.IP_ADDRESS;
    } else {
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
    }
};

/**
 * IP Address of the machine.
 */
const IP_ADDRESS = _get_local_IPv4_address();

/**
 * confirms port in use
 * 
 * @returns {string} port
 */
function _confirm_port() {
    if (ARGV.port) {
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
const PORT = _confirm_port();

/**
 * Get a boolean string
 * 
 * @param {string|undefined} value 
 */
function _confirm_boolean(value) {
    if (typeof value == "boolean") {
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
};

/**
 * Confirm to save logs
 */
function _confirm_save_log() {
    if (ARGV.log) {
        return _confirm_boolean(ARGV.log);
        //check env
    } else if (process.env.SAVE_LOG) {
        return _confirm_boolean(process.env.SAVE_LOG);
    } else {
        return false;
    }
};

/**
 * If logs will be saved.
 */
const SAVE_LOG = _confirm_save_log();

/**
 * confirm xml file output
 */
function _confirm_xml() {
    if (ARGV.xml) {
        return _confirm_boolean(ARGV.xml);
        //check env
    } else if (process.env.CREATE_XML) {
        return _confirm_boolean(process.env.CREATE_XML);
    } else {
        return false;
    }
};

/**
 * If XML guide will be generated.
 */
const CREATE_XML = _confirm_xml();

/**
 * Confirm pseudo channel added to lineup
 */
function _confirm_pseudo() {
    if (ARGV.pseudo) {
        return _confirm_boolean(ARGV.pseudo);
        //check env
    } else if (process.env.INCLUDE_PSEUDOTV_GUIDE) {
        return _confirm_boolean(process.env.INCLUDE_PSEUDOTV_GUIDE);
    } else {
        return false;
    }
}

/**
 * If pseudo channel is part of lineup
 */
const INCLUDE_PSEUDOTV_GUIDE = _confirm_pseudo();

/**
 * Day to pull in advance for line up
 */
function _confirm_guide_days() {
    if (ARGV.days) {
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

/**
 * XML guide days to populate
 */
const GUIDE_DAYS = _confirm_guide_days();

/**
 * for creating and confirming the server URL for the server.
 * 
 * @param {string} PORT
 * @returns {string} url string
 */
function _confirm_url(PORT) {
    return `http://${IP_ADDRESS}:${PORT}`;
};

/**
 * URL of the machine the server connects to.
 * 
 * As ``http://${IP_ADDRESS}:${PORT}``
 */
const SERVER_URL = _confirm_url(PORT);

/**
 * For creating log level for Logger
 * 
 * @returns {number} log number
 */
function _confirm_log_level() {
    switch (LOG_TYPE) {
        case "info":  // No extra info
            return 0;
        case "error": // Adds timestamp info
            return 1;
        case "warn":  // Adds timestamp + Error info
            return 2;
        case "debug": // Adds timestamp + Error info
            return 3;
        default:
            // info
            return 0;
    }
};

/**
 * Interal log level as number for Logger.
 */
const LOG_LEVEL = _confirm_log_level();

/**
 * Confirms name of device
 */
function _confirm_name() {
    if (ARGV.name) {
        return ARGV.name;
        //check env
    } else if (process.env.NAME) {
        return process.env.NAME;
    } else {
        return "Tablo 4th Gen Proxy";
    }
};

/**
 * Name given to the Tablo device
 */
const NAME = _confirm_name();

/**
 * Confirms ID of device
 */
function _confirm_id() {
    if (ARGV.id) {
        return ARGV.id;
        //check env
    } else if (process.env.DEVICE_ID) {
        return process.env.DEVICE_ID;
    } else {
        return "12345678";
    }
};

/**
 * The ID for Tablo device
 */
const DEVICE_ID = _confirm_id();

/**
 * confirms update interval
 */
function _confirm_lineup_interval() {
    if (ARGV.interval) {
        if (Number.isNaN(Number(ARGV.interval))) {
            return 30 * (24 * 60 * 60 * 1000);
        }
        return Number(ARGV.interval) * (24 * 60 * 60 * 1000)
        //check env
    } else if (process.env.LINEUP_UPDATE_INTERVAL) {
        if (Number.isNaN(Number(process.env.LINEUP_UPDATE_INTERVAL))) {
            return 30 * (24 * 60 * 60 * 1000);
        }
        return Number(process.env.LINEUP_UPDATE_INTERVAL) * (24 * 60 * 60 * 1000)
    } else {
        return 30 * (24 * 60 * 60 * 1000);
    }
};

/**
 * Time in days for each lineup update
 */
const LINEUP_UPDATE_INTERVAL = _confirm_lineup_interval();

/**
 * confirms update interval
 */
function _confirm_guide_interval() {
    if (ARGV.interval) {
        if (Number.isNaN(Number(ARGV.guide))) {
            return 24 * (60 * 60 * 1000);
        }
        return Number(ARGV.guide) * (60 * 60 * 1000)
        //check env
    } else if (process.env.GUIDE_UPDATE_INTERVAL) {
        if (Number.isNaN(Number(process.env.GUIDE_UPDATE_INTERVAL))) {
            return 24 * (60 * 60 * 1000);
        }
        return Number(process.env.GUIDE_UPDATE_INTERVAL) * (60 * 60 * 1000)
    } else {
        return 24 * (60 * 60 * 1000);
    }
};

/**
 * Time in hours for guide update
 */
const GUIDE_UPDATE_INTERVAL = _confirm_guide_interval();

/**
 * Confirms device to use
 */
function _confirm_device() {
    if (ARGV.device) {
        return ARGV.device;
        //check env
    } else if (process.env.TABLO_DEVICE) {
        return process.env.TABLO_DEVICE;
    } else {
        return undefined;
    }
};

/**
 * Server ID of the selected Tablo device to use if you have more than 1
 */
const TABLO_DEVICE = _confirm_device();

/**
 * Source path to creds.bin
 */
const CREDS_FILE = path.join(DIR_NAME, "creds.bin");

/**
 * Source path to schedule_lineup.json
 */
const SCHEDULE_LINEUP = path.join(DIR_NAME, "schedule_lineup.json");

/**
 * Source path to schedule_guide.json
 */
const SCHEDULE_GUIDE = path.join(DIR_NAME, "schedule_guide.json");

module.exports = {
    C_HEX,
    ARGV,
    PORT,
    SAVE_LOG,
    LINEUP_UPDATE_INTERVAL,
    GUIDE_UPDATE_INTERVAL,
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
    LOG_TYPE,
    LOG_LEVEL,
    FFMPEG_LOG_LEVEL,
    CREDS_FILE,
    SCHEDULE_LINEUP,
    SCHEDULE_GUIDE
};