// @ts-check
/**
 * @typedef {import('buffer').Buffer} Buffer
 * 
*/

const fs = require('fs');
const XMLWriter = require('xml-writer');
const path = require('path');
const { spawn } = require('child_process');
const {
    Logger,
    JSDate,
    Scheduler,
    FS,
    Encryption,

    C_HEX,
    ARGV,
    PORT,
    LINEUP_UPDATE_INTERVAL,
    INCLUDE_PSEUDOTV_GUIDE,
    GUIDE_DAYS,
    CREATE_XML,
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
} = require('./src/common');
const express = require('express');

const CREDS_FILE = path.join(DIR_NAME, "creds.bin");

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
 * @type {masterCreds}
 */
var CREDS_DATA;

const SCHEDULE_LINEUP = path.join(DIR_NAME, "schedule_lineup.json");

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

const LINEUP_FILE = path.join(DIR_NAME, "lineup.json");

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

const SCHEDULE_GUIDE = path.join(DIR_NAME, "schedule_guide.json");

const GUIDE_FILE = path.join(DIR_NAME, "guide.xml");

/**
 * @type {{[key:string]:{GuideNumber:string, GuideName:string, URL:string, type:string, srcURL:string}}}
 */
var LINEUP_DATA;

/**
 * Amount of streams allowed
 */
var TUNER_COUNT = 2;

/**
 * Count for running streams
 */
var CURRENT_STREAMS = 0;

/**
 * @type {Scheduler}
 */
var SCHEDULE;

/**
 * @type {Scheduler}
 */
var GUIDE;

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {express.NextFunction} next 
 * @param {string} port
 */
async function _middleware(req, res, next, port) {
    const ip = req.ip;

    const path = req.path;

    // Allow any origin (you can specify a specific origin if needed)
    res.header('Access-Control-Allow-Origin', '*');

    // Allowed headers (customize as needed)
    //res.header('Access-Control-Allow-Headers', 'Origin, Access-Control-Allow-Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Allowed methods (customize as needed)
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');


    if (!(path == "/discover.json" || path == "/lineup_status.json")) {
        Logger.debug(`Req ${ip && ip.replace(/::ffff:/, "")}:${port}${path}`);
    }

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
    } else {
        next(); // Move to the next middleware or route handler
    }

    return;
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {string} name 
 * @param {string} serverURL 
 * @param {string} DeviceID 
 * @param {number} tuners
 */
async function _discover(req, res, name, serverURL, DeviceID, tuners) {
    const discover = {
        FriendlyName: name, // "Tablo 4th Gen Proxy",
        Manufacturer: "tablo2plex",
        ModelNumber: "HDHR3-US",
        FirmwareName: "hdhomerun3_atsc",
        FirmwareVersion: "20240101",
        DeviceID: DeviceID, // "12345678",
        DeviceAuth: "tabloauth123",
        BaseURL: serverURL,// SERVER_URL,
        LocalIP: serverURL,// SERVER_URL,
        LineupURL: `${serverURL}/lineup.json`, // `${SERVER_URL}/lineup.json`
        TunerCount: tuners // TUNER_COUNT
    };

    const headers = {
        'Content-Type': 'application/json'
    };

    res.writeHead(200, headers);

    res.end(JSON.stringify(discover));

    return;
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
async function _lineup(req, res) {
    var lineup = Object.values(LINEUP_DATA);

    const headers = {
        'Content-Type': 'application/json'
    };

    res.writeHead(200, headers);

    res.end(JSON.stringify(lineup));

    return;
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
async function _lineup_status(req, res) {
    const lineup_status = {
        ScanInProgress: 0,
        ScanPossible: 1,
        Source: "Antenna",
        SourceList: ["Antenna"]
    };

    const headers = {
        'Content-Type': 'application/json'
    };

    res.writeHead(200, headers);

    res.end(JSON.stringify(lineup_status));

    return;
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
async function _channel(req, res) {
    const ip = req.ip;

    const channelId = req.params.channelId;

    const selectedChannel = LINEUP_DATA[channelId];

    if (selectedChannel) {
        if (selectedChannel.type == "ott") {
            // request from internet
            try {
                const ffmpeg = spawn('ffmpeg', [
                    '-i', selectedChannel.srcURL,
                    '-c', 'copy',
                    '-f', 'mpegts',
                    '-v', 'repeat+level+panic',
                    'pipe:1'
                ]);

                res.setHeader('Content-Type', 'video/mp2t');

                ffmpeg.stdout.pipe(res);

                ffmpeg.stderr.on('data', (data) => {
                    Logger.error(`[ffmpeg] ${data}`);
                });

                req.on('close', () => {
                    Logger.info('Client disconnected, killing ffmpeg');

                    ffmpeg.kill('SIGINT');
                });

                return;
            } catch (error) {
                // @ts-ignore
                Logger.error('Error starting stream:', error.message);

                res.status(500).send('Failed to start stream');

                return;
            }
        } else if (selectedChannel.type == "ota") {
            // request from device
            if (CURRENT_STREAMS < TUNER_COUNT) {
                const firstReq = await reqTabloDevice("POST", CREDS_DATA.device.url, `/guide/channels/${channelId}/watch`, CREDS_DATA.UUID);

                try {
                    var firstJSON = JSON.parse(firstReq.toString());

                    const ffmpeg = spawn('ffmpeg', [
                        '-i', firstJSON.playlist_url,
                        '-c', 'copy',
                        '-f', 'mpegts',
                        '-v', 'repeat+level+panic',
                        'pipe:1'
                    ]);

                    CURRENT_STREAMS += 1;

                    Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip && ip.replace(/::ffff:/, "")} connected to ${channelId}, spawning ffmpeg stream.`);

                    res.setHeader('Content-Type', 'video/mp2t');

                    ffmpeg.stdout.pipe(res);

                    ffmpeg.stderr.on('data', (data) => {
                        Logger.error(`[ffmpeg] ${data}`);
                    });

                    req.on('close', () => {
                        CURRENT_STREAMS -= 1;

                        Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip && ip.replace(/::ffff:/, "")} disconnected from ${channelId}, killing ffmpeg`);

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
        }
    } else {
        res.status(404).send('Channel not found');

        return;
    }
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
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
}

/**
 * Main Server Function
 * @async
 */
async function _run_server() {
    //check env file
    if (process.env == undefined) {
        Logger.error(`${C_HEX.red}[Error]${C_HEX.reset}: .env file read error.`);

        await exit();
    } else {
        const app = express();

        app.set('trust proxy', true);

        // Middleware to log requests by IP and path
        app.use(async (req, res, next) => {
            return await _middleware(req, res, next, PORT);
        });

        // everything gets routed here to route.
        app.get("/discover.json", async (req, res) => {
            return await _discover(req, res, NAME, SERVER_URL, DEVICE_ID, TUNER_COUNT);
        })

        app.get("/lineup.json", async (req, res) => {
            return await _lineup(req, res);
        })

        app.get("/lineup_status.json", async (req, res) => {
            return await _lineup_status(req, res);
        })

        app.get("/channel/:channelId", async (req, res) => {
            return await _channel(req, res);
        })

        if (CREATE_XML) {
            app.get("/guide.xml", async (req, res) => {
                return await _guide_serve(req, res);
            })
        }

        app.get("/favicon.ico", async (req, res) => {
            res.end("");
        })

        // Start the server
        app.listen(PORT, () => {
            Logger.info(`Server v${VERSION} is running on ${C_HEX.blue}${SERVER_URL}${C_HEX.reset} with ${TUNER_COUNT} tuners`);
            if (CREATE_XML) {
                Logger.info(`Guide data can be found at ${C_HEX.blue}${SERVER_URL}/guide.xml${C_HEX.reset}`);

                const guideLoc = path.join(DIR_NAME, "guide.xml");

                Logger.info(`or ${C_HEX.blue}${guideLoc}${C_HEX.reset}`);
            }
        });
    }
};

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

        headers['User-Agent'] = 'Tablo-FAST/1.7.0 (Mobile; iPhone; iOS 16.6)';

        headers['Content-Type'] = 'application/json';

        headers['Accept'] = '*/*';

        const retData = await makeHTTPSRequest("POST", host, path, headers, JSON.stringify(credsData));

        try {
            loginCreds = JSON.parse(retData);

            if (loginCreds.code == undefined) {
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

    const uuid = UUID();

    masterCreds.UUID = typeof uuid == "string" ? uuid : "";

    Logger.info(`Connecting to device.`);

    const firstReq = await reqTabloDevice("GET", masterCreds.device.url, `/server/info`, masterCreds.UUID);

    try {
        const reqPars = JSON.parse(firstReq.toString());

        if (reqPars && reqPars.model && reqPars.model.tuners) {
            masterCreds.tuners = reqPars.model.tuners;

            TUNER_COUNT = reqPars.model.tuners;

            Logger.info(`Found ${reqPars.model.name} with ${TUNER_COUNT} max tuners found!`);
        }
    } catch (error) {
        Logger.error(`Could not reach device. Make sure it's on the same network and try again!`);

        return await exit();
    }

    Logger.info(`Credentials successfully created!`);

    CREDS_DATA = masterCreds;

    const encryCreds = Encryption.crypt(JSON.stringify(masterCreds));

    FS.writeFile(encryCreds, CREDS_FILE);

    Logger.info(`Credentials successfully encrypted! Ready to use the server!`);

    return 1;
};

async function readCreds() {
    if (CREDS_DATA == undefined) {
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
            CREDS_DATA = JSON.parse(encryCreds.toString());

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

                            xw.endElement();
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

        Logger.info(`Finished creating guide data.`);

        return xw.toString() || "";
    } catch (error) {
        Logger.error(`Issue creating guide data.`, error);

        return "";
    }
}

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

            if (!FS.fileExists(file)) {

                try {
                    const reqPathTD = path1 + el.identifier + "/airings/" + guideDay + "/";

                    const headers = {
                        'User-Agent': 'Tablo-FAST/1.7.0 (Mobile; iPhone; iOS 16.6)',
                        'Accept': '*/*',
                        "Authorization": CREDS_DATA.lighthousetvAuthorization,
                        'Lighthouse': CREDS_DATA.Lighthouse
                    };

                    const dataIn1 = await makeHTTPSRequest("GET", host, reqPathTD, headers);

                    if (dataIn1) {
                        FS.loadingBar(totalFiles, ++currentFile);

                        FS.writeJSON(dataIn1, file);
                    }
                    else {
                        currentFile++;

                        Logger.error(`Could not write ${fileName}`, dataIn1);
                    }
                } catch (error) {
                    currentFile++;

                    Logger.error(error);
                }
            } else {
                FS.loadingBar(totalFiles, ++currentFile);
            }
        }
    }
    process.stdout.write('\n');

    FS.deleteUnlistedFiles(tempFolder, neededFiles);

    const xmlData = await parseGuideData(lineup);

    FS.writeFile(xmlData, GUIDE_FILE);

    return;
}

async function parseLineup() {
    try {
        /**
         * @type {channelLineup[]}
         */
        const lineupParse = FS.readJSON(LINEUP_FILE);

        LINEUP_DATA = {};

        for (let i = 0; i < lineupParse.length; i++) {
            const el = lineupParse[i];

            if (el.kind == "ota") {
                LINEUP_DATA[el.identifier] = {
                    GuideNumber: `${el.ota.major}.${el.ota.minor}`,
                    GuideName: el.ota.callSign,
                    URL: `${SERVER_URL}/channel/${el.identifier}`,
                    type: "ota",
                    srcURL: `${CREDS_DATA.device.url}/guide/channels/${el.identifier}/watch`
                }
            } else if (el.kind == "ott") {
                LINEUP_DATA[el.identifier] = {
                    GuideNumber: `${el.ott.major}.${el.ott.minor}`,
                    GuideName: el.ott.callSign,
                    URL: `${SERVER_URL}/channel/${el.identifier}`,
                    type: "ott",
                    srcURL: el.ott.streamUrl
                }
            }
        }

        return 1;
    } catch (error) {
        Logger.error("Issue with creating new lineup file.", error);

        return await exit();
    }
}

async function makeLineup() {
    await readCreds();

    var host = `lighthousetv.ewscloud.com`;

    var path = `/api/v2/account/${CREDS_DATA.Lighthouse}/guide/channels/`;

    const headers = {};

    headers['Lighthouse'] = CREDS_DATA.Lighthouse;

    headers['Accept'] = '*/*';

    headers['User-Agent'] = 'Tablo-FAST/1.7.0 (Mobile; iPhone; iOS 16.6)';

    headers["Authorization"] = CREDS_DATA.lighthousetvAuthorization;

    headers['Content-Type'] = 'application/json';

    Logger.info("Requesting a new channel lineup file!");

    try {
        const retData = await makeHTTPSRequest("GET", host, path, headers);

        /**
         * @type {channelLineup[]}
         */
        const lineupParse = JSON.parse(retData);

        FS.writeJSON(JSON.stringify(lineupParse, null, 4), LINEUP_FILE);

        await parseLineup();

        Logger.info("Successfully created new channel lineup file!");
    } catch (error) {
        Logger.error("Issue with creating new lineup file.", error);
    }
}

// Starts server
(async function () {
    if (ARGV.lineup) {
        // rerun line pull
        // creates new Scheduler file
        if (!FS.fileExists(CREDS_FILE)) {
            // creds need setting up
            Logger.info(`No creds file found. Lets log into your Tablo account.`);

            Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

            await reqCreds();

            SCHEDULE = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

            await SCHEDULE.runTask();

            if (CREATE_XML) {
                GUIDE = new Scheduler(SCHEDULE_GUIDE, "Update guide data", (24 * 60 * 60 * 1000), cacheGuideData);

                await GUIDE.runTask();
            }
        } else {
            SCHEDULE = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

            await SCHEDULE.runTask();

            if (CREATE_XML) {
                GUIDE = new Scheduler(SCHEDULE_GUIDE, "Update guide data", (24 * 60 * 60 * 1000), cacheGuideData);

                await GUIDE.runTask();
            }
        }
        await exit();
    } else if (ARGV.creds) {
        // creds need setting up
        Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

        SCHEDULE = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

        await SCHEDULE.runTask();

        await exit();
    } else {
        if (!FS.fileExists(CREDS_FILE)) {
            // creds need setting up
            Logger.info(`No creds file found. Lets log into your Tablo account.`);

            Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

            await reqCreds();

            SCHEDULE = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

            await SCHEDULE.scheduleNextRun();
        } else if (!FS.fileExists(LINEUP_FILE)) {
            Logger.info(`No current channel lineup!`);

            SCHEDULE = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

            await SCHEDULE.scheduleNextRun();
        }

        try {
            await readCreds();

            SCHEDULE = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

            await SCHEDULE.scheduleNextRun();

            await parseLineup();
        } catch (error) {
            Logger.error("Could not read lineup file. Check permissions and rerun app with --lineup.");

            return await exit();
        }

        if (CREATE_XML) {
            GUIDE = new Scheduler(SCHEDULE_GUIDE, "Update guide data", (24 * 60 * 60 * 1000), cacheGuideData);

            await GUIDE.scheduleNextRun();
        }

        // Then run the server.
        console.log(`${C_HEX.yellow}-- Press '${C_HEX.green}x${C_HEX.yellow}' at anytime to exit.${C_HEX.reset}`);

        console.log(`${C_HEX.yellow}-- Press '${C_HEX.green}l${C_HEX.yellow}' at anytime to request a new channel lineup / guide.${C_HEX.reset}`);

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.resume();

        process.stdin.on('data', async (key) => {
            if (key[0] == 0x78){ // x key
                if (SCHEDULE) {
                    SCHEDULE.cancel();
                }
                if (GUIDE) {
                    GUIDE.cancel();
                }
                console.log(`${C_HEX.blue}Exiting Process...${C_HEX.reset}`);
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            } else if (key[0] == 0x6C){ // l key
                if (SCHEDULE) {
                    await SCHEDULE.runTask();
                }
                if (GUIDE) {
                    await GUIDE.runTask();
                }
            }
        });

        // Core function here
        _run_server();
    }
})();