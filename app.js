// @ts-check
/**
 * @typedef {import('buffer').Buffer} Buffer
 * 
 * @typedef masterCreds
 * @property {string} lighthousetvAuthorization - For lighthousetv transmissions
 * @property {string} lighthousetvIdentifier - For lighthousetv transmissions
 * @property {{identifier:string, name:string, date_joined:string, preferences:object}} profile
 * @property {{serverId:string, name:string, type:string, product:string, version:string, buildNumber:number, registrationStatus:string, lastSeen:string, reachability:string, url:string}} device
 * @property {string} Lighthouse
 * @property {string} UUID
 * @property {number} tuners
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const {
    Logger,
    Scheduler,
    FS,
    Encryption,

    C_HEX,
    ARGV,
    PORT,
    PORT2,
    LINEUP_UPDATE_INTERVAL,
    OTT_SETTINGS,
    DIR_NAME,
    SERVER_URL,
    SERVER_URL2,

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
 * @type {masterCreds}
 */
var CREDS_DATA;

const SCHEDULE_FILE = path.join(DIR_NAME, "schedule.json");

const LINEUP_FILE = path.join(DIR_NAME, "lineup.json");

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
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {express.NextFunction} next 
 * @param {string} port
 */
function _middleware(req, res, next, port){
    const ip = req.ip;

    const path = req.path;

    if(!(path == "/discover.json" || path == "/lineup_status.json"))
    {
        Logger.debug(`Req ${ip && ip.replace(/::ffff:/,"")}:${port}${path}`);
    }

    next(); // Move to the next middleware or route handler
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {string} name 
 * @param {string} serverURL 
 * @param {string} DeviceID 
 */
async function _discover(req, res, name, serverURL, DeviceID){
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
        LineupURL: `${serverURL}/lineup.json` // `${SERVER_URL}/lineup.json`
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
 * @param {string} type
 */
async function _lineup(req, res, type){
    var lineup = Object.values(LINEUP_DATA);

    if (type == "exclude")
    {
        lineup = lineup.filter((el) => el.type != "ott");
    }
    else if (type == "only")
    {
        lineup = lineup.filter((el) => el.type == "ott");
    }

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
async function _lineup_status(req, res){
    const lineup_status = {
        ScanInProgress: 0,
        ScanPossible: 1,
        Source: "Antenna",
        SourceList: ["Antenna"]
    };

    const headers = {
        'Content-Type': 'application/json'  
    };

    res.writeHead(200,headers);

    res.end(JSON.stringify(lineup_status));

    return;
}

/**
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
async function _channel(req, res){
    const ip = req.ip;

    const channelId = req.params.channelId;

    const selectedChannel = LINEUP_DATA[channelId];

    if(selectedChannel)
    {
        if(selectedChannel.type == "ott")
        {
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
            } catch (error) {
                Logger.error('Error starting stream:', error.message);

                res.status(500).send('Failed to start stream');
            }
        }
        else
        {
            // request from device
            if( CURRENT_STREAMS < TUNER_COUNT )
            {
                const firstReq = await reqTabloDevice("POST",CREDS_DATA.device.url,`/guide/channels/${channelId}/watch`, CREDS_DATA.UUID);

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

                    Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip && ip.replace(/::ffff:/,"")} connected to ${channelId}, spawning ffmpeg stream.`);

                    res.setHeader('Content-Type', 'video/mp2t');
                    
                    ffmpeg.stdout.pipe(res);

                    ffmpeg.stderr.on('data', (data) => {
                        Logger.error(`[ffmpeg] ${data}`);
                    });

                    req.on('close', () => {
                        CURRENT_STREAMS -= 1;

                        Logger.info(`${C_HEX.red_yellow}[${CURRENT_STREAMS}/${TUNER_COUNT}]${C_HEX.reset} Client ${ip && ip.replace(/::ffff:/,"")} disconnected from ${channelId}, killing ffmpeg`);

                        ffmpeg.kill('SIGINT');
                    });
                } catch (error) {
                    Logger.error('Error starting stream:', error.message);

                    res.status(500).send('Failed to start stream');
                }
            }
            else
            {
                Logger.error(`Client ${ip && ip.replace(/::ffff:/,"")} connected to ${channelId}, but max streams are running.`);

                res.status(500).send('Failed to start stream');
            }
        }
    }
    else
    {
        return res.status(404).send('Channel not found');
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
    }
    else
    {
        const app = express();

        app.set('trust proxy', true);

        // Middleware to log requests by IP and path
        app.use((req, res, next) => {
            _middleware(req, res, next, PORT);
        });

        // everything gets routed here to route.
        app.get("/discover.json", async (req, res) => {
            var name = "Tablo 4th Gen Proxy";

            if(OTT_SETTINGS == "split")
            {
                name = "Tablo 4th Gen OTA Proxy";
            }
            
            return await _discover(req, res, name, SERVER_URL, "12345678");
        })

        app.get("/lineup.json", async (req, res) =>{
            var type = "";

            if(OTT_SETTINGS == "split")
            {
                type = "exclude";
            }

            return await _lineup(req, res, type);
        })

        app.get("/lineup_status.json", async (req, res) =>{
            return await _lineup_status(req, res);
        })

        // @ts-ignore
        app.get('/channel/:channelId', async (req, res) => {
            _channel(req, res);
        })

        // Start the server
        app.listen(PORT, () => {
            Logger.info(`Server is running on ${C_HEX.blue}${SERVER_URL}${C_HEX.reset} with ${TUNER_COUNT} tuners${OTT_SETTINGS == "remove" ? " (without ott channels)": ""}`);
        });
    }

    if(OTT_SETTINGS == "split")
    {
        // start second server
        const app2 = express();

        app2.set('trust proxy', true);

        // Middleware to log requests by IP and path
        app2.use((req, res, next) => {
            _middleware(req, res, next, PORT);
        });

        // everything gets routed here to route.
        app2.get("/discover.json", async (req, res) => {
            return await _discover(req, res, "Tablo 4th Gen OTT Proxy", SERVER_URL2, "87654321");
        })

        app2.get("/lineup.json", async (req, res) =>{
            return await _lineup(req, res, "only");
        })

        app2.get("/lineup_status.json", async (req, res) =>{
            return await _lineup_status(req, res);
        })

        // @ts-ignore
        app2.get('/channel/:channelId', async (req, res) => {
            _channel(req, res);
        })

        // Start the server
        app2.listen(PORT2, () => {
            Logger.info(`Server is running on ${C_HEX.blue}${SERVER_URL2}${C_HEX.reset} with ott content only.`);
        });
    }
};

async function reqCreds()
{
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
        const user = await input("What is your email?");

        const pass = await input("What is your password?", true);

        const credsData = {
            password: pass,
            email: user,
        };

        host = `lighthousetv.ewscloud.com`;

        path = "/api/v2/login/";

        headers['User-Agent'] = 'Tablo-FAST/1.7.0 (Mobile; iPhone; iOS 16.6)';

        headers['Content-Type'] = 'application/json';

        headers['Accept'] = '*/*';

        const retData = await makeHTTPSRequest("POST",host, path, headers, JSON.stringify(credsData));

        try {
            loginCreds = JSON.parse(retData);
            if(loginCreds.code == undefined)
            {
                if(loginCreds.is_verified != true)
                {
                    Logger.info(`${C_HEX.blue}NOTE:${C_HEX.reset} While password was accepted, account is not verified.\nPlease check email to make sure your account is fully set up. There may be issues later.`);
                }
                if(loginCreds.token_type != undefined && loginCreds.access_token != undefined)
                {
                    Logger.info(`Loggin was accepted!`);

                    loginCreds.Authorization = `${loginCreds.token_type} ${loginCreds.access_token}`;

                    loggedIn = true;
                }  
            }
            else
            {
                if(loginCreds.code)
                {
                    Logger.error(`Loggin was not accepted: ${loginCreds.message}`);
                }
                else
                {
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

            if(deviceData.identifier == undefined)
            {
                Logger.error(`User identifier missing from return. Please check your account and try again.`);

                return await exit();
            }
            else
            {
                masterCreds.lighthousetvIdentifier = deviceData.identifier;
            }

            if(deviceData.code == undefined)
            {
                // lets get the profile
                if(deviceData.profiles == undefined)
                {
                    Logger.error(`User profile data missing from return. Please check your account and try again.`);

                    return await exit();
                }
                else if(deviceData.profiles.length == 1)
                {
                    const profile = deviceData.profiles[0];

                    masterCreds.profile = profile;

                    Logger.info(`Using profile ${profile.name}`);
                }
                else
                {
                    // lets select which profile we want to use
                    const list = [];

                    for (let i = 0; i < deviceData.profiles.length; i++) 
                    {
                        const el = deviceData.profiles[i];

                        list.push(
                            {value: el.name}
                        );
                    }

                    const answer = await choose("Select which profile to use.", list);

                    const profile = deviceData.profiles.find((el) => el.name == answer);
                    
                    masterCreds.profile = profile;

                    Logger.info(`Using profile ${profile.name}`);
                }

                // lets get the device
                if(deviceData.devices == undefined)
                {
                    Logger.error(`User device data missing from return. Please check your account and try again.`);

                    return await exit();
                }
                else if(deviceData.devices.length == 1)
                {
                    const device = deviceData.devices[0];

                    masterCreds.device = device;

                    Logger.info(`Using device ${device.name} ${device.serverId} @ ${device.url}`);

                    selectedDevice = true;
                }
                else
                {
                    // lets select which device we want to use
                    const list = [];

                    for (let i = 0; i < deviceData.devices.length; i++) 
                    {
                        const el = deviceData.devices[i];

                        list.push(
                            {value: el.serverId}
                        );
                    }

                    const answer = await choose("Select which device to use with Plex.", list);

                    const device = deviceData.devices.find((el) => el.serverId == answer);
                    
                    masterCreds.device = device;

                    Logger.info(`Using device ${device.name} ${device.serverId} @ ${device.url}`);

                    selectedDevice = true;
                }
            }
            else
            {
                if(deviceData.code)
                {
                    Logger.error(`Account loggin was not accepted: ${deviceData.message}`);
                }
                else
                {
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

            if(lighthouseData.token != undefined)
            {
                Logger.info(`Account token found!`);

                masterCreds.Lighthouse = lighthouseData.token;

                gotLighthouse = true;
            }
            else
            {
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

    masterCreds.UUID =  typeof uuid == "string" ? uuid : "";

    const firstReq = await reqTabloDevice("GET", masterCreds.device.url,`/server/info`, masterCreds.UUID);

    try {
        const reqPars = JSON.parse(firstReq.toString());

        if(reqPars && reqPars.model && reqPars.model.tuners)
        {
            masterCreds.tuners = reqPars.model.tuners;

            Logger.info(`${reqPars.model.name} with ${masterCreds.tuners} max tuners found!`);
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

async function readCreds(){
    if(CREDS_DATA == undefined){
        const masterCreds = FS.readFile(CREDS_FILE);

        const encryCreds = Encryption.decrypt(masterCreds);

        if(encryCreds[0] != 0x7B)
        {
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
    }
    else
    {
        return;
    }
}

async function parseLineup(){
    try {
        const lineupParse = FS.readJSON(LINEUP_FILE);

        LINEUP_DATA = {};

        for (let i = 0; i < lineupParse.length; i++) {
            const el = lineupParse[i];

            if(el.kind == "ota")
            {
                LINEUP_DATA[el.identifier] = {
                    GuideNumber: `${el.ota.major}.${el.ota.minor}`,
                    GuideName: el.ota.callSign,
                    URL: `${SERVER_URL}/channel/${el.identifier}`,
                    type: "ota",
                    srcURL: `${CREDS_DATA.device.url}/guide/channels/${el.identifier}/watch`
                }
            }
            else if (el.kind == "ott")
            {
                LINEUP_DATA[el.identifier] = {
                    GuideNumber: `${el.ott.major}.${el.ott.minor}`,
                    GuideName: el.ott.callSign,
                    URL: OTT_SETTINGS == "split" ? `${SERVER_URL2}/channel/${el.identifier}` : `${SERVER_URL}/channel/${el.identifier}`,
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

async function makeLineup(){
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
    if (ARGV.lineup) 
    {
        // rerun line pull
        // creates new Scheduler file
        if(!FS.fileExists(CREDS_FILE))
        {
            // creds need setting up
            Logger.info(`No creds file found. Lets log into your Tablo account.`);

            Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

            await reqCreds();

            await makeLineup();
        }
        else
        {
            await makeLineup();
        }
        await exit();
    }
    else if (ARGV.creds) 
    {
        // creds need setting up
        Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

        await reqCreds();

        await exit();
    }
    else
    {
        if(!FS.fileExists(CREDS_FILE))
        {
            // creds need setting up
            Logger.info(`No creds file found. Lets log into your Tablo account.`);

            Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

            await reqCreds();

            await makeLineup();
        }
        else if(!FS.fileExists(LINEUP_FILE))
        {
            Logger.info(`No current channel lineup!`);

            await makeLineup();
        }

        try {
            await readCreds();

            await parseLineup();
        } catch (error) {
            Logger.error("Could not read lineup file. Rerun app with --lineup.");

            await exit();
        } 

        SCHEDULE = new Scheduler(SCHEDULE_FILE, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

        // Then run the server.
        console.log(`${C_HEX.yellow}-- Press '${C_HEX.green}x${C_HEX.yellow}' at anytime to exit.${C_HEX.reset}`);

        console.log(`${C_HEX.yellow}-- Press '${C_HEX.green}l${C_HEX.yellow}' at anytime to request a new channel lineup.${C_HEX.reset}`);

        process.stdin.setRawMode(true);

        process.stdin.resume();

        process.stdin.on('data', (key) => {
            if (key[0] == 0x78) // x key
            { 
                console.log(`${C_HEX.blue}Exiting Process...${C_HEX.reset}`);
                if(SCHEDULE)
                {
                    SCHEDULE.cancel();
                }
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
            }
            else if (key[0] == 0x6C) // l key
            {
                makeLineup();
            }
        });
        
        // Core function here
        _run_server();  
    }
})();