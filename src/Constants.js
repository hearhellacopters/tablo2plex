// @ts-check
const pack = require('../package.json');
const { Command, Option } = require('commander');
const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Defined .env file key
 */
const DEFAULT_ENV_VALUES = [
    {
        desc: '; Name of the device that shows up in Plex',
        key: 'NAME',
        value: "Tablo 4th Gen Proxy"
    },
    {
        desc: '; Fake ID of the device for when you have more than one device on the network',
        key: 'DEVICE_ID',
        value: "12345679"
    },
    {
        desc: '; The port for the plex server to reach\n; default "8181"',
        key: 'PORT',
        value: '8181'
    },
    {
        desc: '; How often the app rechecks the server for the channel lineup in days\n; Note: Can be triggered manually once the app is running\n; Is triggered more often when creating your own XML guide data\n; default "30" (once a month)',
        key: 'LINEUP_UPDATE_INTERVAL',
        value: '30'
    },
    {
        desc: "; If you want to create an xml guide for the channels from Tablo's data instead of Plex\n; While more accurate, requires more requests and processing time to build\n; Will create a new lineup file once a day\n; default \"false\"",
        key: 'CREATE_XML',
        value: 'false'
    },
    {
        desc: "; The amount of days the guide will populate\n; The more days, the longer it will take to populate on update\n; default \"2\", max \"7\"",
        key: 'GUIDE_DAYS',
        value: '2'
    },
    {
        desc: "; Due to issues with Plex not loading more than one EPG\n; You can include the guide data with your guide as long as it's at /.pseudotv/xmltv.xml\n; default \"false\"",
        key: 'INCLUDE_PSEUDOTV_GUIDE',
        value: 'false'
    },
    {
        desc: '; Logger level.\n; debug = Logs everything\n; warn  = Also logs stuff to look out for\n; error = Logs just info and errors\n; info  = Just the basics are logged\n; default "error"',
        key: 'LOG_LEVEL',
        value: 'error'
    },
    {
        desc: '; If you want to create a log file of all console output.\n; Contents of the file is based on the LOG_LEVEL and found in the /logs folder\n; default "false"',
        key: 'SAVE_LOG',
        value: 'false'
    },
    {
        desc: '; Overide the output directory. Default is excution directory.',
        key: 'OUT_DIR',
        value: ''
    },
    {
        desc: '; Device to use if you have more than one on your account.',
        key: 'TABLO_DEVICE',
        value: ''
    },
    {
        desc: "; Username to use for when creds.bin isn't present.",
        key: 'USER_NAME',
        value: ''
    },
    {
        desc: "; Password to use for when creds.bin isn't present.",
        key: 'USER_PASS',
        value: ''
    },
    {
        desc: "; Set the IP Address of Tablo2Plex statically.",
        key: 'IP_ADDRESS',
        value: ''
    },
    {
        desc: "; How often to update your XML guide data in hours\n; default \"24\" (once a day)",
        key: 'GUIDE_UPDATE_INTERVAL',
        value: '24'
    },
    {
        desc: "; Include OTT (Over-The-Top) channels in the line up (default \"true\")",
        key: 'INCLUDE_OTT',
        value: 'true'
    }
];

/**
 * Base path where server is running.
 * 
 * @returns {string} directory name
 */
function _init_dir_name() {
    // @ts-ignore
    if (process.pkg) {
        return path.dirname(process.execPath);
    } else {
        return process.cwd();
    }
};

/**
 * Ensures environment variable in .env file. does NOT update the value.
 * 
 * @example
 * ```js
 * ensureEnvVariables(ENV_FILE_PATH, [{desc: "; API key for secret", key: "API_KEY", value: "new-secret-key"}]);
 * ```
 * 
 * @param {string} envPath File .env path
 * @param {{desc: string, key: string, value: string}[]} updateValues key and value to change
 */
function ensureEnvVariables(envPath, updateValues) {
    const envData = parseEnvFile(envPath);

    const updatedKeys = [];

    for (let i = 0; i < updateValues.length; i++) {
        const el = updateValues[i];

        const {
            key
        } = el;

        if (envData.find(self => self.key == key) == undefined) {
            envData.push(el);

            updatedKeys.push(el);
        }
    }

    if (updatedKeys.length != 0) {
        console.log(`\x1b[36m[info]\x1b[0m Updated missing keys in .env: `);

        for (let i = 0; i < updatedKeys.length; i++) {
            const el = updatedKeys[i];

            console.log(`\x1b[36m[info]\x1b[0m     ${el.key}="${el.value}"`);
        }

        console.log(`\x1b[36m[info]\x1b[0m Please check and update your .env file.`);

        var updatedLines = "";

        for (let i = 0; i < envData.length; i++) {
            const el = envData[i];

            updatedLines += `${el.desc}\n${el.key}="${el.value}"\n`;
        }

        fs.writeFileSync(envPath, updatedLines);
    }
};

/**
 * parses a .env file
 * 
 * @param {string} envPath 
 * @returns {{desc: string, key: string, value: string}[]}
 */
function parseEnvFile(envPath) {
    let content = "";

    try {
        content = fs.readFileSync(envPath).toString();
    } catch (err) {
        // @ts-ignore
        if (err.code !== "ENOENT") {
            throw err;
        }
    }

    const lines = content.split(/\r?\n/);

    const result = [];

    let currentDesc = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith(';')) {
            currentDesc.push(trimmed);
        } else if (trimmed.length > 0) {
            const equalIndex = trimmed.indexOf('=');

            if (equalIndex > 0) {
                const key = trimmed.slice(0, equalIndex).trim();

                let value = trimmed.slice(equalIndex + 1).trim();

                if ((value.startsWith('"') &&
                    value.endsWith('"')) || (value.startsWith("'") &&
                        value.endsWith("'"))
                ) {
                    value = value.slice(1, -1);
                }

                const desc = currentDesc.join('\n');

                result.push({ desc, key, value });

                currentDesc = [];
            }
        }
    }

    return result;
};

/**
 * Ensure the .env file and it's values
 */
function ensureEnvFile() {
    try {
        fs.accessSync(path.join(_init_dir_name(), "/.env"), fs.constants.F_OK);
        // File exists
        ensureEnvVariables(path.join(_init_dir_name(), "/.env"), DEFAULT_ENV_VALUES);
    } catch (error) {
        // @ts-ignore
        if (error.code === 'ENOENT') {
            // File does not exist, create new one with defaults
            console.log(`\x1b[35m[warn]\x1b[0m .env file missing, creating a new default one.`);

            console.log(`\x1b[36m[info]\x1b[0m Please check and update your .env file.`);

            var fileData = "";

            for (let i = 0; i < DEFAULT_ENV_VALUES.length; i++) {
                const el = DEFAULT_ENV_VALUES[i];

                fileData += `${el.desc}\n${el.key}="${el.value}"\n`;
            }

            fs.writeFileSync(path.join(_init_dir_name(), "/.env"), fileData);
        }
    }
};

ensureEnvFile();

require('dotenv').config({ path: path.join(_init_dir_name(), "/.env") });

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
    .addOption(new Option('-c, --creds', 'Force creation of new creds file.'))
    .addOption(new Option('-l, --lineup', 'Force creation of a fresh channel lineup file.'))

    .addOption(new Option('-n, --name <string>', 'Name of the device that shows up in Plex.').env("NAME"))
    .addOption(new Option('-f, --id <string>', 'Fake ID of the device for when you have more than one device on the network.').env("DEVICE_ID"))
    .addOption(new Option('-p, --port <string>', 'Overide the port.').env("PORT"))
    .addOption(new Option('-i, --channels <number>', 'How often the app rechecks the server for the channel lineup in days.').env("LINEUP_UPDATE_INTERVAL"))
    .addOption(new Option('-x, --xml <boolean>', 'If you want to create an xml guide for the channels from Tablo\'s data instead of Plex.').env("CREATE_XML"))
    .addOption(new Option('-d, --days <number>', 'The amount of days the guide will populate.').env("GUIDE_DAYS"))
    .addOption(new Option('-s, --pseudo <boolean>', 'Include the guide data with your guide as long as it\'s at \/.pseudotv\/xmltv.xml').env("INCLUDE_PSEUDOTV_GUIDE"))
    .addOption(new Option('-g, --level <boolean>', 'Logger level.').env("LOG_LEVEL").choices(["info", "error", "warn", "debug"]))
    .addOption(new Option('-k, --log <boolean>', 'If you want to create a log file of all console output.').env("SAVE_LOG"))
    .addOption(new Option('-o, --outdir <string>', 'Overide the output directory. Default is excution directory').env("OUT_DIR"))
    .addOption(new Option('-v, --device <string>', 'Server ID of the Tablo device to use if you have more than 1.').env("TABLO_DEVICE"))
    .addOption(new Option('-u, --user <string>', 'Username to use for when creds.bin isn\'t present. (Note: will auto select profile)').env("USER_NAME"))
    .addOption(new Option('-w, --pass <string>', 'Password to use for when creds.bin isn\'t present. (Note: will auto select profile)').env("USER_PASS"))
    .addOption(new Option('-a, --ip_address <string>', 'Set the IP Address of Tablo2Plex statically.').env("IP_ADDRESS"))
    .addOption(new Option(`-e, --guide <number>`, 'How often to update your XML guide data in hours, default once a day.').env("GUIDE_UPDATE_INTERVAL"))
    .addOption(new Option(`-t, --ott <boolean>`, 'Include OTT (Over-The-Top) channels in the line up.').env("INCLUDE_OTT"))
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
function _init_dir_name_post() {
    if (ARGV.outdir != "" && ARGV.outdir != undefined) {
        return ARGV.outdir;
        // @ts-ignore
    } else if (process.pkg) {
        return path.dirname(process.execPath);
    } else {
        return process.cwd();
    }
};

/**
 * confirms username to use, will prompt otherwise
 * 
 * @returns {string|null} port
 */
function _init_username() {
    if (ARGV.user != "" && ARGV.user != undefined) {
        return ARGV.user;
        //check env
    } else {
        return null;
    }
};

/**
 * confirms password to use, will prompt otherwise
 * 
 * @returns {string|null} port
 */
function _init_password() {
    if (ARGV.pass != "" && ARGV.pass != undefined) {
        return ARGV.pass;
        //check env
    } else {
        return null;
    }
};

/**
 * For confirming log level for Logger.
 * 
 * @returns {string} string
 */
function _init_log_type() {
    switch (ARGV.level) {
        case "info":
        case "warn":
        case "error":
        case "debug":
            return ARGV.level;
        default:
            return "error";
    }
};

/**
 * For confirming ffmpeg log level.
 * 
 * @returns {string} string
 */
function _init_ffmpeg_log_level() {
    switch (ARGV.level) {
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
 * Master function for finding machine IP address.
 * 
 * @returns {string} example ``'127.0.0.1'``
 */
function _init_local_IPv4_address() {
    if (ARGV.ip_address) {
        return ARGV.ip_address;
        //check env
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
 * confirms port in use
 * 
 * @returns {string} port
 */
function _init_port() {
    if (ARGV.port) {
        return ARGV.port;
    } else {
        return "8181";
    }
};

/**
 * Get a boolean string
 * 
 * @param {string|undefined} value 
 */
function _confirm_boolean(value) {
    if (typeof value == "boolean") {
        return value;
    } else if (value == undefined) {
        return false;
    } else if (typeof value != "string") {
        return false;
    } else if (value.toLowerCase() == "true") {
        return true;
    } else {
        return false;
    }
};

/**
 * Confirm to save logs
 */
function _init_save_log() {
    if (ARGV.log) {
        return _confirm_boolean(ARGV.log);
    } else {
        return false;
    }
};

/**
 * confirm xml file output
 */
function _init_xml() {
    if (ARGV.xml) {
        return _confirm_boolean(ARGV.xml);
    } else {
        return false;
    }
};

/**
 * Confirm pseudo channel added to lineup
 */
function _init_pseudo() {
    if (ARGV.pseudo) {
        return _confirm_boolean(ARGV.pseudo);
    } else {
        return false;
    }
};

/**
 * Day to pull in advance for line up
 */
function _init_guide_days() {
    if (ARGV.days) {
        var num = Number(ARGV.days);
        if (num > 0 && num < 8) {
            return num;
        } else {
            return 2;
        }
    } else {
        return 2;
    }
};

/**
 * For creating log level for Logger
 * 
 * @param {string} LOG_TYPE 
 * @returns {number} log number
 */
function _init_log_level(LOG_TYPE) {
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
 * Confirms name of device
 */
function _init_name() {
    if (ARGV.name) {
        return ARGV.name;
    } else {
        return "Tablo 4th Gen Proxy";
    }
};

/**
 * Confirms ID of device
 */
function _init_device_id() {
    if (ARGV.id) {
        return ARGV.id;
    } else {
        return "12345679";
    }
};

/**
 * confirms update interval
 */
function _init_lineup_interval() {
    if (ARGV.channels) {
        if (Number.isNaN(Number(ARGV.channels))) {
            return 30 * (24 * 60 * 60 * 1000);
        }
        return Number(ARGV.channels) * (24 * 60 * 60 * 1000)
    } else {
        return 30 * (24 * 60 * 60 * 1000);
    }
};

/**
 * confirms update interval
 */
function _init_guide_interval() {
    if (ARGV.guide) {
        if (Number.isNaN(Number(ARGV.guide))) {
            return 24 * (60 * 60 * 1000);
        }
        return Number(ARGV.guide) * (60 * 60 * 1000)
    } else {
        return 24 * (60 * 60 * 1000);
    }
};

/**
 * Confirms device to use
 */
function _init_device() {
    if (ARGV.device != "" && ARGV.device != undefined) {
        return ARGV.device;
    } else {
        return undefined;
    }
};

/**
 * confirms to include OTT (Over-The-Top) channels in line up
 * 
 * @returns {boolean} port
 */
function _init_ott() {
    if (ARGV.ott) {
        return _confirm_boolean(ARGV.ott);
    } else {
        return true;
    }
};

/**
 * Gets machine architecture 
 * 
 * @returns {string}
 */
function _get_machine_architecture() {
    return process.arch;
};

/**
 * Gets machines operating system
 * 
 * @returns {string}
 */
function _get_machine_os() {
    return process.platform;
};

/**
 * Static class of all server constants
 * 
 * @class
 */
class CONST {
    /**
     * @type {{[x: string]: any}?}
     */
    static #ARGV = null;
    /**
     * @type {string?}
     */
    static #DIR_NAME = null;
    /**
     * @type {string?}
     */
    static #ENV_FILE_PATH = null;
    /**
     * @type {string?}
     */
    static #NAME = null;
    /**
     * @type {{ desc: string, key: string, value: string }[]?}
     */
    static #DEFAULT_ENV_VALUES = null;
    /**
     * @type {string?}
     */
    static #VERSION = null;
    /**
     * @type {string?}
     */
    static #DEVICE_ID = null;
    /**
     * @type {number?}
     */
    static #LOG_LEVEL = null;
    /**
     * @type {boolean?}
     */
    static #SAVE_LOG = null;
    /**
     * @type {string?}
     */
    static #IP_ADDRESS = null;
    /**
     * @type {string?}
     */
    static #PORT = null;
    /**
     * @type {number?}
     */
    static #GUIDE_UPDATE_INTERVAL = null;
    /**
     * @type {boolean?}
     */
    static #INCLUDE_OTT = null;
    /**
     * @type {number?}
     */
    static #LINEUP_UPDATE_INTERVAL = null;
    /**
     * @type {boolean?}
     */
    static #CREATE_XML = null;
    /**
     * @type {number?}
     */
    static #GUIDE_DAYS = null;
    /**
     * @type {boolean?}
     */
    static #INCLUDE_PSEUDOTV_GUIDE = null;
    /**
     * @type {string?}
     */
    static #TABLO_DEVICE = null;
    /**
     * @type {string?}
     */
    static #USER_NAME = null;
    /**
     * @type {string?}
     */
    static #USER_PASS = null;
    /**
     * @type {string?}
     */
    static #SERVER_URL = null;
    /**
     * @type {boolean?}
     */
    static #AUTO_PROFILE = null;
    /**
     * @type {string?}
     */
    static #LOG_TYPE = null;
    /**
     * @type {string?}
     */
    static #FFMPEG_LOG_LEVEL = null;
    /**
     * @type {string?}
     */
    static #CREDS_FILE = null;
    /**
     * @type {string?}
     */
    static #SCHEDULE_LINEUP = null;
    /**
     * @type {string?}
     */
    static #SCHEDULE_GUIDE = null
    /**
     * @type {string?}
     */
    static #MACHINE_ARCH = null;
    /**
     * @type {string?}
     */
    static #MACHINE_OS = null;
    static keys = [
        "ARGV",
        "DIR_NAME",
        "DEFAULT_ENV_VALUES",
        "ENV_FILE_PATH",
        "NAME",
        "VERSION",
        "DEVICE_ID",
        "PORT",
        "LINEUP_UPDATE_INTERVAL",
        "CREATE_XML",
        "GUIDE_DAYS",
        "INCLUDE_PSEUDOTV_GUIDE",
        "LOG_LEVEL",
        "SAVE_LOG",
        "TABLO_DEVICE",
        "USER_NAME",
        "USER_PASS",
        "IP_ADDRESS",
        "GUIDE_UPDATE_INTERVAL",
        "INCLUDE_OTT",
        "SERVER_URL",
        "AUTO_PROFILE",
        "LOG_TYPE",
        "FFMPEG_LOG_LEVEL",
        "CREDS_FILE",
        "SCHEDULE_LINEUP",
        "SCHEDULE_GUIDE",
        "MACHINE_ARCH",
        "MACHINE_OS"
    ];
    /**
     * Init constants
     * 
     * @param {boolean?} ignoreARGV only on restart
     */
    static init(ignoreARGV = false) {
        this.#ARGV = ignoreARGV ? {} : ARGV;

        this.#DIR_NAME = _init_dir_name_post();

        this.#DEFAULT_ENV_VALUES = DEFAULT_ENV_VALUES;

        this.#ENV_FILE_PATH = path.join(_init_dir_name(), "/.env");

        this.#NAME = _init_name();

        this.#VERSION = pack.version;

        this.#DEVICE_ID = _init_device_id();

        this.#PORT = _init_port();

        this.#LINEUP_UPDATE_INTERVAL = _init_lineup_interval();

        this.#CREATE_XML = _init_xml();

        this.#GUIDE_DAYS = _init_guide_days();

        this.#INCLUDE_PSEUDOTV_GUIDE = _init_pseudo();

        this.#LOG_TYPE = _init_log_type();

        this.#LOG_LEVEL = _init_log_level(this.#LOG_TYPE);

        this.#SAVE_LOG = _init_save_log();

        this.#TABLO_DEVICE = _init_device();

        this.#USER_NAME = _init_username();

        this.#USER_PASS = _init_password();

        this.#IP_ADDRESS = _init_local_IPv4_address();

        this.#GUIDE_UPDATE_INTERVAL = _init_guide_interval();

        this.#INCLUDE_OTT = _init_ott();

        this.#SERVER_URL = `http://${this.#IP_ADDRESS}:${this.#PORT}`;

        this.#AUTO_PROFILE = this.#USER_NAME != undefined ? true : false;        

        this.#FFMPEG_LOG_LEVEL = _init_ffmpeg_log_level();

        this.#CREDS_FILE = path.join(this.#DIR_NAME, "creds.bin");

        this.#SCHEDULE_LINEUP = path.join(this.#DIR_NAME, "schedule_lineup.json");

        this.#SCHEDULE_GUIDE = path.join(this.#DIR_NAME, "schedule_guide.json");

        this.#MACHINE_ARCH = _get_machine_architecture();

        this.#MACHINE_OS = _get_machine_os();
    };
    /**
     * Command line arguments.
     * 
     * @type {{[key: string]: any}}
     */
    static get ARGV() {
        if (this.#ARGV != null) {
            return this.#ARGV;
        } else {
            this.init();

            if (this.#ARGV != null) {
                return this.#ARGV;
            } else {
                return {};
            }
        }
    };
    /**
     * Base path where server is running.
     * 
     * Used in finding files to load.
     * 
     * @type {string}
     */
    static get DIR_NAME() {
        if (this.#DIR_NAME != null) {
            return this.#DIR_NAME;
        } else {
            this.init();

            if (this.#DIR_NAME != null) {
                return this.#DIR_NAME;
            } else {
                return "";
            }
        }
    };
    /**
     * Default defined .env file key
     * 
     * @type {{desc: string, key: string, value: string}[]}
     */
    static get DEFAULT_ENV_VALUES() {
        if (this.#DEFAULT_ENV_VALUES != null) {
            return this.#DEFAULT_ENV_VALUES;
        } else {
            this.init();

            if (this.#DEFAULT_ENV_VALUES != null) {
                return this.#DEFAULT_ENV_VALUES;
            } else {
                return [];
            }
        }
    };
    /**
     * .env file path
     * 
     * @type {string}
     */
    static get ENV_FILE_PATH() {
        if (this.#ENV_FILE_PATH != null) {
            return this.#ENV_FILE_PATH;
        } else {
            this.init();

            if (this.#ENV_FILE_PATH != null) {
                return this.#ENV_FILE_PATH;
            } else {
                return "";
            }
        }
    };
    /**
     * Name given to the Tablo device
     * 
     * @type {string}
     */
    static get NAME(){
        if (this.#NAME != null) {
            return this.#NAME;
        } else {
            this.init();

            if (this.#NAME != null) {
                return this.#NAME;
            } else {
                return "Tablo 4th Gen Proxy";
            }
        }
    };
    /**
     * Current version of the serever software.
     * 
     * @type {string}
     */
    static get VERSION() {
        if (this.#VERSION != null) {
            return this.#VERSION;
        } else {
            this.init();

            if (this.#VERSION != null) {
                return this.#VERSION;
            } else {
                return "";
            }
        }
    };
    /**
     * The ID for Tablo device
     * 
     * @type {string}
     */
    static get DEVICE_ID(){
        if (this.#DEVICE_ID != null) {
            return this.#DEVICE_ID;
        } else {
            this.init();

            if (this.#DEVICE_ID != null) {
                return this.#DEVICE_ID;
            } else {
                return "12345679";
            }
        }
    };
    /**
     * Port the server is using.
     * 
     * @type {string}
     */
    static get PORT() {
        if (this.#PORT != null) {
            return this.#PORT;
        } else {
            this.init();

            if (this.#PORT != null) {
                return this.#PORT;
            } else {
                return "8181";
            }
        }
    };
    /**
     * Time in days for each lineup update
     * 
     * @type {number}
     */
    static get LINEUP_UPDATE_INTERVAL(){
        if (this.#LINEUP_UPDATE_INTERVAL != null) {
            return this.#LINEUP_UPDATE_INTERVAL;
        } else {
            this.init();

            if (this.#LINEUP_UPDATE_INTERVAL != null) {
                return this.#LINEUP_UPDATE_INTERVAL;
            } else {
                return 30 * (24 * 60 * 60 * 1000);
            }
        }
    };
    /**
     * If XML guide will be generated.
     * 
     * @type {boolean}
     */
    static get CREATE_XML(){
        if (this.#CREATE_XML != null) {
            return this.#CREATE_XML;
        } else {
            this.init();

            if (this.#CREATE_XML != null) {
                return this.#CREATE_XML;
            } else {
                return false;
            }
        }
    };
    /**
     * XML guide days to populate
     * 
     * @type {number}
     */
    static get GUIDE_DAYS(){
        if (this.#GUIDE_DAYS != null) {
            return this.#GUIDE_DAYS;
        } else {
            this.init();

            if (this.#GUIDE_DAYS != null) {
                return this.#GUIDE_DAYS;
            } else {
                return 2;
            }
        }
    };
    /**
     * If pseudo channel is part of lineup
     * 
     * @type {boolean}
     */
    static get INCLUDE_PSEUDOTV_GUIDE(){
        if (this.#INCLUDE_PSEUDOTV_GUIDE != null) {
            return this.#INCLUDE_PSEUDOTV_GUIDE;
        } else {
            this.init();

            if (this.#INCLUDE_PSEUDOTV_GUIDE != null) {
                return this.#INCLUDE_PSEUDOTV_GUIDE;
            } else {
                return false;
            }
        }
    };
    /**
     * Log level for server logging.
     * 
     * @type {number}
     */
    static get LOG_LEVEL() {
        if (this.#LOG_LEVEL != null) {
            return this.#LOG_LEVEL;
        } else {
            this.init();

            if (this.#LOG_LEVEL != null) {
                return this.#LOG_LEVEL;
            } else {
                return 0;
            }
        }
    };
    /**
     * If logs will be saved.
     * 
     * @type {boolean}
     */
    static get SAVE_LOG(){
        if (this.#SAVE_LOG != null) {
            return this.#SAVE_LOG;
        } else {
            this.init();

            if (this.#SAVE_LOG != null) {
                return this.#SAVE_LOG;
            } else {
                return false;
            }
        }
    };
    /**
     * Server ID of the selected Tablo device to use if you have more than 1
     * 
     * @type {string|undefined}
     */
    static get TABLO_DEVICE(){
        if (this.#TABLO_DEVICE != null) {
            return this.#TABLO_DEVICE;
        } else {
            this.init();

            if (this.#TABLO_DEVICE != null) {
                return this.#TABLO_DEVICE;
            } else {
                return undefined;
            }
        }
    };
    /**
     * User name for auto creds.bin creation.
     */
    static get USER_NAME(){
        if (this.#USER_NAME != null) {
            return this.#USER_NAME;
        } else {
            this.init();

            if (this.#USER_NAME != null) {
                return this.#USER_NAME;
            } else {
                return null;
            }
        }
    };
    /**
     * User password for auto creds.bin creation.
     */
    static get USER_PASS(){
        if (this.#USER_PASS != null) {
            return this.#USER_PASS;
        } else {
            this.init();

            if (this.#USER_PASS != null) {
                return this.#USER_PASS;
            } else {
                return null;
            }
        }
    };
    /**
     * IP Address of the machine.
     * 
     * @type {string}
     */
    static get IP_ADDRESS() {
        if (this.#IP_ADDRESS != null) {
            return this.#IP_ADDRESS;
        } else {
            this.init();

            if (this.#IP_ADDRESS != null) {
                return this.#IP_ADDRESS;
            } else {
                return "127.0.0.1";
            }
        }
    };
    /**
     * Time in hours for guide update
     * 
     * @type {number}
     */
    static get GUIDE_UPDATE_INTERVAL(){
        if (this.#GUIDE_UPDATE_INTERVAL != null) {
            return this.#GUIDE_UPDATE_INTERVAL;
        } else {
            this.init();

            if (this.#GUIDE_UPDATE_INTERVAL != null) {
                return this.#GUIDE_UPDATE_INTERVAL;
            } else {
                return 24 * (60 * 60 * 1000);
            }
        }  
    };
    /**
     * Include OTT (Over-The-Top) channels in the line up 
     * 
     * @type {boolean}
     */
    static get INCLUDE_OTT(){
        if (this.#INCLUDE_OTT != null) {
            return this.#INCLUDE_OTT;
        } else {
            this.init();

            if (this.#INCLUDE_OTT != null) {
                return this.#INCLUDE_OTT;
            } else {
                return true;
            }
        } 
    };
    /**
     * URL of the machine the game connects to.
     * 
     * As ``http://${IP_ADDRESS}:${PORT}/``
     * 
     * @type {string}
     */
    static get SERVER_URL() {
        if (this.#SERVER_URL != null) {
            return this.#SERVER_URL;
        } else {
            this.init();

            if (this.#SERVER_URL != null) {
                return this.#SERVER_URL;
            } else {
                return "";
            }
        }
    };
    /**
     * For auto selection a profile.
     * 
     * @type {boolean}
     */
    static get AUTO_PROFILE(){
        if (this.#AUTO_PROFILE != null) {
            return this.#AUTO_PROFILE;
        } else {
            this.init();

            if (this.#AUTO_PROFILE != null) {
                return this.#AUTO_PROFILE;
            } else {
                return false;
            }
        }
    };
    /**
     * Log level string for server logging.
     * 
     * @type {string}
     */
    static get LOG_TYPE(){
        if (this.#LOG_TYPE != null) {
            return this.#LOG_TYPE;
        } else {
            this.init();

            if (this.#LOG_TYPE != null) {
                return this.#LOG_TYPE;
            } else {
                return "error";
            }
        }
    };
    /**
     * Log level for ffmpeg.
     * 
     * @type {string}
     */
    static get FFMPEG_LOG_LEVEL(){
        if (this.#FFMPEG_LOG_LEVEL != null) {
            return this.#FFMPEG_LOG_LEVEL;
        } else {
            this.init();

            if (this.#FFMPEG_LOG_LEVEL != null) {
                return this.#FFMPEG_LOG_LEVEL;
            } else {
                return "panic";
            }
        }
    };
    /**
     * Source path to creds.bin
     */
    static get CREDS_FILE(){
        if (this.#CREDS_FILE != null) {
            return this.#CREDS_FILE;
        } else {
            this.init();

            if (this.#CREDS_FILE != null) {
                return this.#CREDS_FILE;
            } else {
                return path.join(_init_dir_name(), "creds.bin");
            }
        }
    };
    /**
     * Source path to schedule_lineup.json
     * 
     * @type {string}
     */
    static get SCHEDULE_LINEUP(){
        if (this.#SCHEDULE_LINEUP != null) {
            return this.#SCHEDULE_LINEUP;
        } else {
            this.init();

            if (this.#SCHEDULE_LINEUP != null) {
                return this.#SCHEDULE_LINEUP;
            } else {
                return path.join(_init_dir_name(), "schedule_lineup.json");
            }
        }
    };
    /**
     * Source path to schedule_guide.json
     * 
     * @type {string}
     */
    static get SCHEDULE_GUIDE(){
        if (this.#SCHEDULE_GUIDE != null) {
            return this.#SCHEDULE_GUIDE;
        } else {
            this.init();

            if (this.#SCHEDULE_GUIDE != null) {
                return this.#SCHEDULE_GUIDE;
            } else {
                return path.join(_init_dir_name(), "schedule_guide.json");
            }
        }
    };
    /**
     * Gets machines operating system
     * 
     * @type {string}
     */
    static get MACHINE_OS() {
        if (this.#MACHINE_OS != null) {
            return this.#MACHINE_OS;
        } else {
            this.init();

            if (this.#MACHINE_OS != null) {
                return this.#MACHINE_OS;
            } else {
                return "";
            }
        }
    };
    /**
     * Gets machines architecture
     * 
     * @type {string}
     */
    static get MACHINE_ARCH() {
        if (this.#MACHINE_ARCH != null) {
            return this.#MACHINE_ARCH;
        } else {
            this.init();

            if (this.#MACHINE_ARCH != null) {
                return this.#MACHINE_ARCH;
            } else {
                return "";
            }
        }
    };
    /**
     * Current .env values
     * 
     * @type {{[key: string]: any}}
     */
    static get CURRENT_ENV_VALUES() {
        ensureEnvFile();

        var envData = parseEnvFile(path.join(_init_dir_name(), "/.env"));

        const values = {};

        for (let i = 0; i < envData.length; i++) {
            const el = envData[i];
            // @ts-ignore
            values[el.key] = CONST[el.key];
        }

        return values;
    };
    /**
     * Current const values
     * 
     * @type {{[key: string]: any}}
     */
    static get CURRENT_CONST_VALUES() {
        const values = {};

        for (let i = 0; i < this.keys.length; i++) {
            const key = this.keys[i];
            // @ts-ignore
            values[key] = CONST[key];
        }

        return values;
    };
};

/**
 * Updates or insert environment variable in .env file.
 * 
 * @example
 * ```js
 * updateEnvVariable({"API_KEY": "new-secret-key"});
 * ```
 * 
 * @param {{[key: string]: string}} updateValues key and value to change
 */
function updateEnvVariables(updateValues) {
    var envData = parseEnvFile(path.join(_init_dir_name(), "/.env"));

    const keys = Object.keys(updateValues);

    var updated = false;

    const updatedValues = [];

    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        const value = updateValues[key];

        const el = envData.find(self => self.key == key);

        if (el != undefined) {
            if (el.value != value) {
                el.value = value;

                updatedValues.push({key: key, value: value });

                updated = true;
            }
        }
    }

    if (updated) {
        console.log(`Updated .env values:`);

        for (let i = 0; i < updatedValues.length; i++) {
            const el = updatedValues[i];

            console.log(`     ${el.key}="${el.value}"`);
        }

        var updatedLines = "";

        for (let i = 0; i < envData.length; i++) {
            const el = envData[i];

            updatedLines += `${el.desc}\n${el.key}="${el.value}"\n`;
        }

        fs.writeFileSync(path.join(_init_dir_name(), "/.env"), updatedLines);

        console.log(`Please restart server for changes to take affect.`);

        return true;
    }

    return false;
};

module.exports = {
    C_HEX,
    updateEnvVariables,
    CONST,
};