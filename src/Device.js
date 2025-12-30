// @ts-check
/**
 * @typedef {import('express').Response} Response
 * @typedef {import('express').Request} Request
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const XMLWriter = require('xml-writer');
const { spawn } = require('child_process');

const {
    exit,
    choose,
    input
} = require('./CommandLine');
const {
    C_HEX,
    NAME,
    TABLO_DEVICE,
    INCLUDE_PSEUDOTV_GUIDE,
    GUIDE_DAYS,
    USER_NAME,
    USER_PASS,
    AUTO_PROFILE,
    VERSION,
    DEVICE_ID,
    SERVER_URL,
    DIR_NAME,
    LOG_TYPE,
    CREATE_XML,
    FFMPEG_LOG_LEVEL,
    CREDS_FILE
} = require('./Constants');
const Encryption = require('./Encryption');
const FS = require('./FS');
const JSDate = require('./JSDate');
const Logger = require('./Logger');

/**
 * @typedef masterCreds
 * @property {string} lighthousetvAuthorization - For lighthousetv transmissions
 * @property {string} lighthousetvIdentifier - For lighthousetv transmissions
 * @property {{identifier:string, name:string, date_joined:string, preferences:object}} profile
 * @property {{serverId:string, name:string, type:string, product:string, version:string, buildNumber:number, registrationStatus:string, lastSeen:string, reachability:string, url:string}} device
 * @property {string} Lighthouse
 * @property {string} UUID
 * @property {number} tuners
 */

/**
 * @type {masterCreds | any}
 */
const CREDS_DATA = {};

/**
 * Source path to lineup.json
 */
const LINEUP_FILE = path.join(DIR_NAME, "lineup.json");

/**
 * @type {{[key:string]:{GuideNumber:string, GuideName:string, URL:string, type:string, srcURL:string, streamUrl: string}}}
 */
const LINEUP_DATA = {};

/**
 * Source path to guide.xml
 */
const GUIDE_FILE = path.join(DIR_NAME, "guide.xml");

/**
 * Amount of streams allowed
 */
var TUNER_COUNT = 2;

/**
 * Count for running streams
 */
var CURRENT_STREAMS = 0;

/**
 * @typedef {OtaType | OttType} channelLineup
 * 
 * @typedef {Object} OtaType
 * @property {string} identifier
 * @property {string} name
 * @property {"ota"} kind - The kind property must be "ota".
 * @property {Logos[]} logos
 * @property {Kind} ota - The ota property with data.
 * 
 * @typedef {Object} OttType
 * @property {string} identifier
 * @property {string} name
 * @property {"ott"} kind - The kind property must be "ota".
 * @property {Logos[]} logos
 * @property {Kind} ott - The ott property with data.
 * 
 * @typedef Logos
 * @property {string} kind
 * @property {string} url
 * 
 * @typedef Kind
 * @property {number} major
 * @property {number} minor
 * @property {string} callSign
 * @property {string} network
 * @property {string} streamUrl
 * @property {string} provider
 * @property {boolean} canRecord
 */

/**
 * @typedef {episodeType | sportEventType | movieAiringType} guideInfo
 * 
 * @typedef episodeType
 * @property {string} identifier
 * @property {string} title
 * @property {{identifier:string}} channel
 * @property {string} datetime
 * @property {string} onnow
 * @property {string|null} description
 * @property {"episode"} kind
 * @property {number} qualifiers
 * @property {string[]} genres
 * @property {Images[]} images
 * @property {number} duration
 * @property {{identifier:string, title:string, sortTitle:string, sectionTitle:string}} show
 * @property {{season: {kind:string, number?:number, string?:string}, episodeNumber:number|null, originalAirDate:string|null, rating:string|null}} episode
 * 
 * @typedef movieAiringType
 * @property {string} identifier
 * @property {string} title
 * @property {{identifier:string}} channel
 * @property {string} datetime
 * @property {string} onnow
 * @property {string|null} description
 * @property {"movieAiring"} kind
 * @property {number} qualifiers
 * @property {string[]} genres
 * @property {Images[]} images
 * @property {number} duration
 * @property {{identifier:string, title:string, sortTitle:string, sectionTitle:string}} show
 * @property {{releaseYear:number, filmRating:string|null, qualityRating:number|null }} movieAiring
 * 
 * @typedef sportEventType
 * @property {string} identifier
 * @property {string} title
 * @property {{identifier:string}} channel
 * @property {string} datetime
 * @property {string} onnow
 * @property {string|null} description
 * @property {"sportEvent"} kind
 * @property {number} qualifiers
 * @property {string[]} genres
 * @property {Images[]} images
 * @property {number} duration
 * @property {{identifier:string, title:string, sortTitle:string, sectionTitle:string}} show
 * @property {{season:string|null}} sportEvent
 * 
 * @typedef Images
 * @property {string} kind
 * @property {string} url
 */

/**
 * Function to handle Tablo streams
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {string} ip
 * @param {string} channelId 
 * @param {{GuideNumber:string, GuideName:string, URL:string, type:string, srcURL:string, streamUrl: string}}  selectedChannel
 */
async function handleStreams(req, res, ip, channelId, selectedChannel){
    if (CURRENT_STREAMS < TUNER_COUNT) {
        const channelReq = await reqTabloDevice("POST", CREDS_DATA.device.url, `/guide/channels/${channelId}/watch`, CREDS_DATA.UUID, "lh");

        try {
            /**
             * @type {{token: string, expires: string, keepalive: number, playlist_url: string, video_details: {container_format: string, flags: any[]}}}
             */
            const channelJSON = JSON.parse(channelReq.toString());
            // check if there is a playlist_url
            if (channelJSON.playlist_url == undefined) {
                Logger.error('playlist_url missing from requested channel:');

                Logger.error(channelJSON);

                Logger.error(selectedChannel);

                res.status(500).send('Failed to find playlist url.');

                return;
            }

            Logger.debug("Tablo Response:");

            Logger.debug(channelJSON);

            const ffmpeg = spawn('ffmpeg', [
                '-i', channelJSON.playlist_url,
                '-c', 'copy',
                '-f', 'mpegts',
                '-v', `repeat+level+${FFMPEG_LOG_LEVEL}`,
                'pipe:1'
            ]);

            if (selectedChannel.type == "ota") {
                CURRENT_STREAMS += 1;

                Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip.replace(/::ffff:/, "")} connected to ${channelId}, spawning ffmpeg stream.`);
            } else {
                Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip.replace(/::ffff:/, "")} connected to ${channelId} (IPTV), spawning ffmpeg stream.`);
            }

            res.setHeader('Content-Type', 'video/mp2t');

            ffmpeg.stdout.pipe(res);

            ffmpeg.stderr.on('data', (data) => {
                switch (FFMPEG_LOG_LEVEL) {
                    case "info":
                        Logger.info(`[ffmpeg] ${data}`);
                        break;
                    case "debug":
                        Logger.debug(`[ffmpeg] ${data}`);
                        break;
                    case "warning":
                        Logger.warn(`[ffmpeg] ${data}`);
                        break;
                    default:
                        Logger.error(`[ffmpeg] ${data}`);
                        break;
                }
            });

            req.on('close', () => {
                if (selectedChannel.type == "ota") {
                    CURRENT_STREAMS -= 1;

                    Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip && ip.replace(/::ffff:/, "")} disconnected from ${channelId}, killing ffmpeg`);
                } else {
                    Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip && ip.replace(/::ffff:/, "")} disconnected from ${channelId} (IPTV), killing ffmpeg`);
                }

                ffmpeg.kill('SIGINT');
            });

            return;
        } catch (error) {
            // @ts-ignore
            Logger.error('Error starting stream:', error.message);

            res.status(500).send('Failed to start stream');

            return;
        }
    } else {
        Logger.error(`Client ${ip && ip.replace(/::ffff:/, "")} connected to ${channelId}, but max streams are running.`);

        res.status(500).send('Failed to start stream');

        return;
    }
};

/**
 * Start up message
 */
function startUpMessage(){
    Logger.info(`Server v${VERSION} is running on ${C_HEX.blue}${SERVER_URL}${C_HEX.reset} with ${TUNER_COUNT} tuners`);
    if (CREATE_XML) {
        Logger.info(`Guide data can be found at ${C_HEX.blue}${SERVER_URL}/guide.xml${C_HEX.reset}`);

        const guideLoc = path.join(DIR_NAME, "guide.xml");

        Logger.info(`or ${C_HEX.blue}${guideLoc}${C_HEX.reset}`);
    }
    if (LOG_TYPE == "debug") {
        Logger.debug("Debug mode is active!");

        Logger.debug(`It is recommended that you have ${C_HEX.blue}SAVE_LOG${C_HEX.reset} = ${C_HEX.green}true${C_HEX.reset} while debugging.`);

        Logger.debug("When finished, please delete all logs as they will contain sensitive private info.");
    }
};

/**
 * Makes discover object end point data
 */
function makeDiscover(){
    return {
        FriendlyName: NAME, // "Tablo 4th Gen Proxy",
        Manufacturer: "tablo2plex",
        ModelNumber: "HDHR3-US",
        FirmwareName: "hdhomerun3_atsc",
        FirmwareVersion: "20240101",
        DeviceID: DEVICE_ID, // "12345678",
        DeviceAuth: "tabloauth123",
        BaseURL: SERVER_URL,// SERVER_URL,
        LocalIP: SERVER_URL,// SERVER_URL,
        LineupURL: `${SERVER_URL}/lineup.json`, // `${SERVER_URL}/lineup.json`
        TunerCount: TUNER_COUNT // TUNER_COUNT
    }
};

/**
 * lineup endpint
 * 
 * @param {Request} req 
 * @param {Response} res 
 */
async function _lineup(req, res) {
var lineup = Object.values(LINEUP_DATA);

    const headers = {
        'Content-Type': 'application/json'
    };

    res.writeHead(200, headers);

    res.end(JSON.stringify(lineup));

    return;
};

/**
 * Makes Tablo device request
 * 
 * @param {string} method 
 * @param {string} host 
 * @param {string} path 
 * @param {string} msg 
 * @param {{"Content-Type"?:string,Connection?:string,Date?:string,Accept?:string,"User-Agent"?:string,"Content-Length"?:string,Authorization?:string}} headers 
 * @param {string} params 
 * @returns {Promise<Buffer>}
 */
async function makeTabloRequest(method, host, path, msg = "", headers = {}, params = "") {
    const url = host + path;

    const baseUrl = new URL(path, host);

    baseUrl.search = params;

    const date = JSDate.deviceDate();

    headers["Connection"] = "keep-alive";

    headers["Date"] = date;

    headers["Accept"] = "*/*";

    headers["User-Agent"] = "Tablo-FAST/1.7.0 (Mobile; iPhone; iOS 18.4)";

    const auth = Encryption.makeDeviceAuth(method, path, msg, date);

    var body;

    if (method == "POST" && msg != "") {
        body = Buffer.from(msg);

        headers["Content-Length"] = `${body.length}`;
    }

    headers["Authorization"] = auth;

    Logger.debug("Tablo Request:");

    Logger.debug(headers);

    Logger.debug(msg);

    return await fetch(
        baseUrl.toString(),
        {
            method: method,
            headers: headers,
            body: method == "POST" ? body : undefined
        }
    ).then(async response => {
        if (response) {
            return Buffer.from(await response.arrayBuffer());
        } else {
            Logger.error(`Fetching device ${url}`);

            return Buffer.alloc(0);
        }
    });
};

/**
 * Handles all Tablo device requests
 * 
 * @param {string} method 
 * @param {string} host 
 * @param {string} path 
 * @param {string} UUID
 * @param {string} params
 */
async function reqTabloDevice(method, host, path, UUID, params) {
    const headers = {};
    /**
     * @type {any}
     */
    const dataIn = {};
    if (method == "POST") {
        headers["Content-Type"] = "application/x-www-form-urlencoded";

        dataIn["bandwidth"] = null;

        dataIn["extra"] = {
            "limitedAdTracking": 1,
            "deviceOSVersion": "16.6",
            "lang": "en_US",
            "height": 1080,
            "deviceId": "00000000-0000-0000-0000-000000000000",
            "width": 1920,
            "deviceModel": "iPhone10,1",
            "deviceMake": "Apple",
            "deviceOS": "iOS",
        };

        dataIn["device_id"] = UUID;

        dataIn["platform"] = "ios";
    }
    return await makeTabloRequest(method, host, path, method == "POST" ? JSON.stringify(dataIn) : "", headers, params);
};

/**
 * channel end point 
 * 
 * @param {Request} req 
 * @param {Response} res 
 */
async function _channel(req, res, ) {
    const ip = req.ip || "";

    const channelId = req.params.channelId;

    const selectedChannel = LINEUP_DATA[channelId];

    if (selectedChannel) {
        // check if there is a srcURL
        if (selectedChannel.srcURL == undefined) {
            Logger.error('srcURL missing from requested channel:');

            Logger.error(selectedChannel);

            res.status(500).send('Failed to find stream url.');

            return;
        }

        await handleStreams(req, res, ip, channelId, selectedChannel);

    } else {
        res.status(404).send('Channel not found');

        Logger.error(`Channel not found: ${channelId}`);

        return;
    }
};

/**
 * guide.xml end point
 * 
 * @param {Request} req 
 * @param {Response} res 
 */
async function _guide_serve(req, res) {
    try {
        const data = FS.readFile(GUIDE_FILE);

        const headers = {
            "content-type": "application/xml"
        }

        res.writeHead(200, headers);

        res.end(data);

        return;
    } catch (error) {
        res.status(404).send('Guide not found');
        return;
    }
};

/**
 * basic https request
 * 
 * @param {string} method 
 * @param {string} hostname 
 * @param {string} path 
 * @param {any} headers 
 * @param {string|Buffer} data 
 * @param {boolean} justHeaders
 * @returns {Promise<any>}
 */
async function makeHTTPSRequest(method, hostname, path, headers, data = "", justHeaders = false) {
    return new Promise((resolve, reject) => {
        // Convert the data
        if (typeof data == "string") {
            data = Buffer.from(data);
        } else if (!(data instanceof Buffer)) {
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
                if (justHeaders) {
                    resolve(res.headers);
                }

                if (res.statusCode == undefined || (res.statusCode < 200 || res.statusCode > 299)){
                    Logger.error('Https request failed with status code:', res.statusCode);

                    Logger.error('Error details:', dataIn);

                    reject(new Error(`Https request failed with status code ${res.statusCode}`));
                } else {
                    try {
                        resolve(dataIn);
                    } catch (parseError) {
                        // @ts-ignore
                        reject(new Error(`Failed to parse response: ${parseError.message}`));
                    }
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
};

/**
 * Request for new creds
 */
async function reqCreds() {
    /**
     * @type {masterCreds}
     */
    const masterCreds = {};

    var loggedIn = false;

    var loginCreds;

    const headers = {};

    var host;

    var path;

    do {
        const user = USER_NAME != undefined ? USER_NAME : await input("What is your email?");

        const pass = USER_PASS != undefined ? USER_PASS : await input("What is your password?", true);

        const credsData = {
            password: pass,
            email: user,
        };

        host = `lighthousetv.ewscloud.com`;

        path = "/api/v2/login/";

        headers['User-Agent'] = 'Tablo-FAST/2.0.0 (Mobile; iPhone; iOS 16.6)';

        headers['Content-Type'] = 'application/json';

        headers['Accept'] = '*/*';

        const retData = await makeHTTPSRequest("POST", host, path, headers, JSON.stringify(credsData));

        try {
            loginCreds = JSON.parse(retData);

            if (loginCreds.code == undefined) {
                Logger.debug("lighthousetv login");

                Logger.debug(loginCreds);

                if (loginCreds.is_verified != true) {
                    Logger.info(`${C_HEX.blue}NOTE:${C_HEX.reset} While password was accepted, account is not verified.\nPlease check email to make sure your account is fully set up. There may be issues later.`);
                }
                if (loginCreds.token_type != undefined && loginCreds.access_token != undefined) {
                    Logger.info(`Loggin was accepted!`);

                    loginCreds.Authorization = `${loginCreds.token_type} ${loginCreds.access_token}`;

                    loggedIn = true;
                }
            } else {
                if (loginCreds.code) {
                    Logger.error(`Loggin was not accepted: ${loginCreds.message}`);
                } else {
                    Logger.error(`Loggin was not successful, try again later!`);

                    return await exit();
                }
            }
        } catch (error) {
            Logger.error(`Loggin was not accepted or had issues, try again!`);
        }
    } while (!loggedIn);
    // we should have access_token and token_type by now
    const lighthousetvAuthorization = loginCreds.Authorization;

    masterCreds.lighthousetvAuthorization = lighthousetvAuthorization;

    path = '/api/v2/account/';

    headers["Authorization"] = lighthousetvAuthorization;

    var selectedDevice = false;

    var deviceData;

    do {
        const retData = await makeHTTPSRequest("GET", host, path, headers);

        try {
            deviceData = JSON.parse(retData);

            if (deviceData.identifier == undefined) {
                Logger.error(`User identifier missing from return. Please check your account and try again.`);

                return await exit();
            } else {
                masterCreds.lighthousetvIdentifier = deviceData.identifier;
            }

            if (deviceData.code == undefined) {
                Logger.debug("lighthousetv account");

                Logger.debug(deviceData);

                // lets get the profile
                if (deviceData.profiles == undefined) {
                    Logger.error(`User profile data missing from return. Please check your account and try again.`);

                    return await exit();
                } else if (deviceData.profiles.length == 1) {
                    const profile = deviceData.profiles[0];

                    masterCreds.profile = profile;

                    Logger.info(`Using profile ${profile.name}`);
                } else {
                    // lets select which profile we want to use
                    const list = [];

                    for (let i = 0; i < deviceData.profiles.length; i++) {
                        const el = deviceData.profiles[i];

                        list.push(
                            { value: el.name }
                        );
                    }

                    if (AUTO_PROFILE) {
                        const profile = deviceData.profiles[0];

                        masterCreds.profile = profile;

                        Logger.info(`Using profile ${profile.name}`);
                    } else {
                        const answer = await choose("Select which profile to use.", list);

                        const profile = deviceData.profiles.find((/**@type {{name:string}}*/el) => el.name == answer);

                        masterCreds.profile = profile;

                        Logger.info(`Using profile ${profile.name}`);
                    }
                }

                // lets get the device
                if (deviceData.devices == undefined) {
                    Logger.error(`User device data missing from return. Please check your account and try again.`);

                    return await exit();
                } else if (deviceData.devices.length == 1) {
                    const device = deviceData.devices[0];

                    masterCreds.device = device;

                    Logger.info(`Using device ${device.name} ${device.serverId} @ ${device.url}`);

                    selectedDevice = true;
                } else {
                    // lets select which device we want to use
                    if (TABLO_DEVICE) {
                        const device = deviceData.devices.find((/**@type {{serverId:string}}*/el) => el.serverId == TABLO_DEVICE);

                        if (device) {
                            masterCreds.device = device;

                            Logger.info(`Using device ${device.name} ${device.serverId} @ ${device.url}`);

                            selectedDevice = true;
                        } else {
                            Logger.error(`Device with serverId ${TABLO_DEVICE} not found.`);

                            Logger.warn("Falling back to manual selection.");
                        }
                    }

                    if (!selectedDevice) {
                        const list = [];

                        for (let i = 0; i < deviceData.devices.length; i++) {
                            const el = deviceData.devices[i];

                            list.push(
                                { value: el.serverId }
                            );
                        }

                        const answer = await choose("Select which device to use with Plex.", list);

                        const device = deviceData.devices.find((/**@type {{serverId:string}}*/el) => el.serverId == answer);

                        masterCreds.device = device;

                        Logger.info(`Using device ${device.name} ${device.serverId} @ ${device.url}`);

                        selectedDevice = true;
                    }
                }
            } else {
                if (deviceData.code) {
                    Logger.error(`Account loggin was not accepted: ${deviceData.message}`);
                } else {
                    Logger.error(`Account loggin was not successful, try again!`);

                    return await exit();
                }
            }
        } catch (error) {
            Logger.error(`Account loggin was not accepted or had issues, try again!`);

            return await exit();
        }
    } while (!selectedDevice);

    Logger.info(`Getting account token.`);

    var gotLighthouse = false;

    var lighthouseData;

    path = "/api/v2/account/select/";

    do {
        const req = {
            pid: masterCreds.profile.identifier,
            sid: masterCreds.device.serverId
        };

        const retData = await makeHTTPSRequest("POST", host, path, headers, JSON.stringify(req));

        try {
            lighthouseData = JSON.parse(retData);

            if (lighthouseData.token != undefined) {
                Logger.info(`Account token found!`);

                masterCreds.Lighthouse = lighthouseData.token;

                gotLighthouse = true;
            } else {
                Logger.error(`Account token was not found, try again!`);

                return await exit();
            }
        } catch (error) {
            Logger.error(`Account token was not accepted or had issues, try again!`);
            return await exit();
        }
    } while (!gotLighthouse);

    headers["Lighthouse"] = masterCreds.Lighthouse;

    const uuid = Encryption.UUID();

    masterCreds.UUID = typeof uuid == "string" ? uuid : "";

    Logger.info(`Connecting to device.`);

    const firstReq = await reqTabloDevice("GET", masterCreds.device.url, `/server/info`, masterCreds.UUID, "lh");

    try {
        const reqPars = JSON.parse(firstReq.toString());

        if (reqPars && reqPars.model && reqPars.model.tuners) {
            masterCreds.tuners = reqPars.model.tuners;

            TUNER_COUNT = reqPars.model.tuners;

            Logger.info(`Found ${reqPars.model.name} with ${TUNER_COUNT} max tuners found!`);

            Logger.debug("server info");

            Logger.debug(reqPars);
        }
    } catch (error) {
        Logger.error(`Could not reach device. Make sure it's on the same network and try again!`);

        return await exit();
    }

    Logger.info(`Credentials successfully created!`);

    Object.assign(CREDS_DATA, masterCreds);

    const encryCreds = Encryption.crypt(JSON.stringify(masterCreds));

    FS.writeFile(encryCreds, CREDS_FILE);

    Logger.info(`Credentials successfully encrypted! Ready to use the server!`);

    return 1;
};

/**
 * Requests new creds file
 */
async function readCreds() {
    if (CREDS_DATA.UUID == undefined) {
        const masterCreds = FS.readFile(CREDS_FILE);

        const encryCreds = Encryption.decrypt(masterCreds);

        if (encryCreds[0] != 0x7B) {
            try {
                Logger.error("Issue decrypting creds file. Removing creds file. Please start app again or use --creds command line to create a new file.");

                fs.unlinkSync(CREDS_FILE);

                return await exit();
            } catch (error) {
                Logger.error("Issue decrypting creds file, could not delete bad file. Your app may have read write issues. Please check your folder settings and start the app again or use --creds command line to create a new file.");

                return await exit();
            }
        }
        try {
            Object.assign(CREDS_DATA, JSON.parse(encryCreds.toString()));

            TUNER_COUNT = CREDS_DATA.tuners;
        } catch (error) {
            try {
                Logger.error("Issue reading decrypted creds file, Removing creds file. Please start app again or use --creds command line to create a new file.");

                fs.unlinkSync(CREDS_FILE);
                return await exit();
            } catch (error) {
                Logger.error("Issue reading creds file, could not delete bad file. Your app may have read write issues. Please check your folder settings and start the app again or use --creds command line to create a new file.");

                return await exit();
            }
        }
    } else {
        return;
    }
}

/**
 * Creates XML guide data from downloaded guide files
 * 
 * @param {channelLineup[]} lineUp 
 */
async function parseGuideData(lineUp) {
    try {
        const guideDays = JSDate.getDaysFromToday(GUIDE_DAYS);

        const xw = new XMLWriter(true);

        xw.startDocument();

        xw.startElement('tv');

        xw.writeAttribute('generator-info-name', 'Tablo 4th Gen Proxy');

        for (let i = 0; i < lineUp.length; i++) {
            const el = lineUp[i];

            // write channel
            xw.startElement('channel');

            var channelNum = "";

            if (el.kind == "ota") {
                channelNum = `${el.ota.major}.${el.ota.minor}`;

                xw.writeAttribute('id', channelNum);

                xw.startElement('display-name');

                xw.writeAttribute('lang', 'en');

                xw.text(el.ota.callSign);

                xw.endElement(); // display-name
            } else {
                channelNum = `${el.ott.major}.${el.ott.minor}`;

                xw.writeAttribute('id', channelNum);

                xw.startElement('display-name');

                xw.writeAttribute('lang', 'en');

                xw.text(el.ott.callSign);

                xw.endElement(); // display-name
            }

            if (el.logos.length != 0) {
                xw.startElement('icon');

                const lightLarge = el.logos.find(self => self.kind == "lightLarge");

                if (lightLarge) {
                    xw.writeAttribute('src', lightLarge.url);
                } else {
                    xw.writeAttribute('src', el.logos[0].url);
                }

                xw.endElement(); // icon
            }

            xw.endElement(); // channel

            /**
             * @type {guideInfo[][]}
             */
            const filesData = [];

            var totalForChannel = 0;

            var curCount = 0;

            for (let z = 0; z < guideDays.length; z++) {
                const guideDay = guideDays[z];

                const fileNameTD = el.identifier + "_" + guideDay + ".json";

                const fileTD = path.join(DIR_NAME, "tempGuide", fileNameTD);

                /**
                 * @type {guideInfo[]}
                 */
                const tdData = FS.readJSON(fileTD);

                filesData.push(tdData);

                totalForChannel += tdData.length;
            }

            Logger.info(`Creating ${el.name} - ${channelNum} guide data.`);

            //write programme
            for (let q = 0; q < filesData.length; q++) {
                const tdData = filesData[q];

                for (let z = 0; z < tdData.length; z++) {
                    const tdEL = tdData[z];

                    const end = new Date(tdEL.datetime).getTime() + (tdEL.duration * 1000);

                    if (end > Date.now()) {
                        const startDate = JSDate.getXMLDateString(tdEL.datetime);

                        const endDate = JSDate.getXMLDateString(end);

                        // parse data
                        xw.startElement('programme');

                        xw.writeAttribute('start', startDate);

                        xw.writeAttribute('stop', endDate);

                        xw.writeAttribute('channel', channelNum);

                        xw.startElement('title');

                        xw.writeAttribute('lang', 'en');

                        if (tdEL.kind == "episode" &&
                            tdEL.episode.episodeNumber != null
                        ) {

                            xw.text(tdEL.show.title.replace(/[\n\r]+/g, " "));

                            xw.endElement(); // title

                            xw.writeRaw('\n        <previously-shown/>');

                            xw.startElement('sub-title');

                            xw.writeAttribute('lang', 'en');

                            xw.text(tdEL.title.replace(/[\n\r]+/g, " "));

                            xw.endElement(); // sub-title

                            xw.startElement('episode-num');

                            xw.writeAttribute('system', 'xmltv_ns');

                            var season = 1;

                            if (tdEL.episode.season.kind != "none" &&
                                tdEL.episode.season.kind != "number"
                            ) {
                                season = Number(tdEL.episode.season.number);
                            }

                            xw.text((season - 1) + ' . ' + (tdEL.episode.episodeNumber - 1) + ' . 0/1');

                            xw.endElement(); // episode-num
                        } else {
                            xw.text(tdEL.title.replace(/[\n\r]+/g, " "));

                            xw.endElement(); // title
                        }

                        if (tdEL.images.length != 0) {
                            xw.startElement('icon');

                            xw.writeAttribute('src', tdEL.images[0].url);

                            xw.endElement(); // icon
                        }

                        if (tdEL.description != null) {
                            xw.startElement('desc');

                            xw.writeAttribute('lang', 'en');

                            xw.text(tdEL.description.replace(/[\n\r]+/g, " "));

                            xw.endElement(); // desc
                        }

                        if (tdEL.kind == "episode" &&
                            tdEL.episode.rating != null
                        ) {
                            xw.startElement('rating');

                            xw.writeAttribute('system', 'MPAA');

                            xw.writeElement('value', tdEL.episode.rating);

                            xw.endElement();// rating
                        } else if (tdEL.kind == "movieAiring" &&
                            tdEL.movieAiring.filmRating != null
                        ) {
                            xw.startElement('rating');

                            xw.writeAttribute('system', 'MPAA');

                            xw.writeElement('value', tdEL.movieAiring.filmRating);

                            xw.endElement();// rating
                        }

                        xw.endElement(); // programme

                        FS.loadingBar(totalForChannel, ++curCount);
                    } else {
                        FS.loadingBar(totalForChannel, ++curCount);
                    }
                }
            }
            process.stdout.write('\n');
            // clear spam
            if (process.stdout.isTTY) {
                process.stdout.moveCursor(0, -1);

                process.stdout.clearLine(1);

                process.stdout.moveCursor(0, -1);
                
                process.stdout.clearLine(1);

                process.stdout.cursorTo(0);
            } else {
                Logger.info('Guide data update completed.');
            }
        }

        if (INCLUDE_PSEUDOTV_GUIDE) {
            if (FS.fileExists(path.join(DIR_NAME, "/.pseudotv/xmltv.xml"))) {
                const personal = FS.readFile(path.join(DIR_NAME, "/.pseudotv/xmltv.xml"));

                const lines = personal.toString().split('\n');

                // Remove the 2nd and last line
                const cleanedLines = lines.slice(2, -1);

                const cleanedData = cleanedLines.join('\n');

                xw.writeRaw(cleanedData);
            }
        }

        xw.endElement(); // tv

        xw.endDocument();

        return xw.toString() || "";
    } catch (error) {
        Logger.error(`Issue creating guide data.`, error);

        return "";
    }
}

/**
 * Downloads guide files 
 */
async function cacheGuideData() {
    const tempFolder = path.join(DIR_NAME, "tempGuide");

    if (!FS.directoryExists(tempFolder)) {
        FS.createDirectory(tempFolder);
    }

    const guideDays = JSDate.getDaysFromToday(GUIDE_DAYS);

    const host = `lighthousetv.ewscloud.com`;

    const path1 = "/api/v2/account/guide/channels/"; // /api/v2/account/guide/channels/S122912_503_01/airings/2025-04-20/

    /**
     * @type {channelLineup[]}
     */
    const lineup = FS.readJSON(LINEUP_FILE);

    const neededFiles = [];

    const totalFiles = lineup.length * GUIDE_DAYS;

    var currentFile = 0;

    Logger.info(`Prepping ${totalFiles} needed guide files.`);

    for (let i = 0; i < lineup.length; i++) {
        const el = lineup[i];

        for (let z = 0; z < guideDays.length; z++) {
            const guideDay = guideDays[z];

            const fileName = el.identifier + "_" + guideDay + ".json";

            neededFiles.push(fileName);

            const file = path.join(tempFolder, fileName);

            const reqPathTD = path1 + el.identifier + "/airings/" + guideDay + "/";

            const headers = {
                'User-Agent': 'Tablo-FAST/2.0.0 (Mobile; iPhone; iOS 16.6)',
                'Accept': '*/*',
                "Authorization": CREDS_DATA.lighthousetvAuthorization,
                'Lighthouse': CREDS_DATA.Lighthouse
            };

            if (!FS.fileExists(file)) {
                // new file
                try {
                    const dataIn1 = await makeHTTPSRequest("GET", host, reqPathTD, headers);

                    if (dataIn1) {
                        FS.loadingBar(totalFiles, ++currentFile);

                        FS.writeJSON(dataIn1, file);
                    } else {
                        currentFile++;

                        Logger.error(`Could not write ${fileName}`, dataIn1);
                    }
                } catch (error) {
                    currentFile++;

                    Logger.error(error);
                }
            } else {
                // check file size
                try {
                    const head = await makeHTTPSRequest("HEAD", host, reqPathTD, headers, "", true);

                    const sizeIn = parseInt(head['content-length']);

                    const stats = await fs.promises.stat(file);

                    if(stats.size != sizeIn){
                        // if they don't match, there is new data, get the file
                        const dataIn1 = await makeHTTPSRequest("GET", host, reqPathTD, headers);

                        FS.writeJSON(dataIn1, file);
                        
                        FS.loadingBar(totalFiles, ++currentFile);
                    } else {
                        FS.loadingBar(totalFiles, ++currentFile);
                    }
                } catch (error) {
                    currentFile++;

                    Logger.error(error);
                }
            }
        }
    }

    process.stdout.write('\n');
    // clear spam
    if (process.stdout.isTTY) {
        process.stdout.moveCursor(0, -1);

        process.stdout.clearLine(1);

        process.stdout.moveCursor(0, -1);

        process.stdout.clearLine(1);

        process.stdout.cursorTo(0);
    } else {
        Logger.info('Guide data caching completed.');
    }

    FS.deleteUnlistedFiles(tempFolder, neededFiles);

    const xmlData = await parseGuideData(lineup);

    FS.writeFile(xmlData, GUIDE_FILE);

    return;
}

/**
 * Creates channel lineup data
 * 
 * @param {channelLineup[]|undefined} lineup 
 */
async function parseLineup(lineup = undefined) {
    /**
     * @type {channelLineup[]}
     */
    var lineupParse = lineup ?? FS.readJSON(LINEUP_FILE);
    try {
        for (let i = 0; i < lineupParse.length; i++) {
            const el = lineupParse[i];

            if (el.kind == "ota") {
                LINEUP_DATA[el.identifier] = {
                    GuideNumber: `${el.ota.major}.${el.ota.minor}`,
                    GuideName: el.ota.callSign,
                    URL: `${SERVER_URL}/channel/${el.identifier}`,
                    type: "ota",
                    streamUrl: `${CREDS_DATA.device.url}/guide/channels/${el.identifier}/watch`,
                    srcURL: `${CREDS_DATA.device.url}/guide/channels/${el.identifier}/watch`
                }
            } else if (el.kind == "ott") {
                LINEUP_DATA[el.identifier] = {
                    GuideNumber: `${el.ott.major}.${el.ott.minor}`,
                    GuideName: el.ott.callSign,
                    URL: `${SERVER_URL}/channel/${el.identifier}`,
                    type: "ott",
                    streamUrl: el.ott.streamUrl,
                    srcURL: `${CREDS_DATA.device.url}/guide/channels/${el.identifier}/watch`,
                }
            } else {
                Logger.error("Unknown lineup type:");

                Logger.error(el);
            }
        }

        return 1;
    } catch (error) {
        Logger.error("Issue with creating new lineup file.", error);

        return await exit();
    }
}

/**
 * Requests new channel line up data
 */
async function makeLineup() {
    await readCreds();

    var host = `lighthousetv.ewscloud.com`;

    var path = `/api/v2/account/${CREDS_DATA.Lighthouse}/guide/channels/`;

    const headers = {};

    headers['Lighthouse'] = CREDS_DATA.Lighthouse;

    headers['Accept'] = '*/*';

    headers['User-Agent'] = 'Tablo-FAST/2.0.0 (Mobile; iPhone; iOS 16.6)';

    headers["Authorization"] = CREDS_DATA.lighthousetvAuthorization;

    headers['Content-Type'] = 'application/json';

    try {
        const retData = await makeHTTPSRequest("GET", host, path, headers);

        /**
         * @type {channelLineup[]}
         */
        const lineupParse = JSON.parse(retData);

        FS.writeJSON(JSON.stringify(lineupParse, null, 4), LINEUP_FILE);

        await parseLineup(lineupParse);
    } catch (error) {
        Logger.error("Issue with creating new lineup file.", error);
    }
};

module.exports = {
    startUpMessage,
    makeDiscover,
    _lineup,
    _channel,
    _guide_serve,
    readCreds,
    reqCreds,
    makeLineup,
    cacheGuideData,
    parseLineup
};