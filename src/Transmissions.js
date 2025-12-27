// @ts-check
const express = require('express');

const {
    exit
} = require('./CommandLine');
const {
    C_HEX,
    PORT,
    CREATE_XML,
} = require('./Constants');
const {
    startUpMessage,
    makeDiscover,
    _lineup,
    _channel,
    _guide_serve,
} = require("./Device");
const Logger = require('./Logger');

/**
 * basic middleware
 *  
 * @param {express.Request} req 
 * @param {express.Response} res 
 * @param {express.NextFunction} next 
 * @param {string} port
 */
async function _middleware(req, res, next, port) {
    const ip = req.ip || "";

    const path = req.path;

    // Allow any origin (you can specify a specific origin if needed)
    res.header('Access-Control-Allow-Origin', '*');

    // Allowed headers (customize as needed)
    //res.header('Access-Control-Allow-Headers', 'Origin, Access-Control-Allow-Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Allowed methods (customize as needed)
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');


    if (!(path == "/discover.json" || path == "/lineup_status.json")) {
        Logger.debug(`Req ${ip.replace(/::ffff:/, "")}:${port}${path}`);
    }

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
    } else {
        next(); // Move to the next middleware or route handler
    }

    return;
};

/**
 * discover end point
 * 
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
async function _discover(req, res) {
    const discover = makeDiscover();

    const headers = {
        'Content-Type': 'application/json'
    };

    res.writeHead(200, headers);

    res.end(JSON.stringify(discover));

    return;
};

/**
 * lineup_status end point
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
};

/**
 * Main Server Function
 * 
 * @async
 */
async function runServer() {
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
            return await _discover(req, res);
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
            startUpMessage();
        });
    }
};

module.exports = {
    runServer
};