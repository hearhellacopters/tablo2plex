// @ts-check

const {
    exit
} = require('./src/CommandLine');
const {
    C_HEX,
    ARGV,
    LINEUP_UPDATE_INTERVAL,
    CREATE_XML,
    SCHEDULE_LINEUP,
    SCHEDULE_GUIDE,
    GUIDE_UPDATE_INTERVAL,
    CREDS_FILE,
} = require('./src/Constants');
const {
    reqCreds,
    makeLineup,
    readCreds,
    parseLineup,
    cacheGuideData
} = require('./src/Device');
const FS = require('./src/FS');
const Logger = require('./src/Logger');
const Scheduler = require('./src/Scheduler');
const {runServer} = require('./src/Transmissions');

/**
 * @type {Scheduler}
 */
var LINEUP_SCHEDULER;

/**
 * @type {Scheduler}
 */
var GUIDE_SCHEDULER;

// Starts server
(async function () {
    if (ARGV.lineup) {
        // rerun line pull
        // creates new Scheduler file
        Logger.info(`${C_HEX.yellow}Running forced one-time lineup/guide update...${C_HEX.reset}`);

        if (!FS.fileExists(CREDS_FILE)) {
            // creds need setting up
            Logger.info(`No creds file found. Lets log into your Tablo account.`);

            Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

            await reqCreds();
        }

        LINEUP_SCHEDULER = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

        await LINEUP_SCHEDULER.runTask();

        if (CREATE_XML) {
            GUIDE_SCHEDULER = new Scheduler(SCHEDULE_GUIDE, "Update guide data", GUIDE_UPDATE_INTERVAL, cacheGuideData);

            await GUIDE_SCHEDULER.runTask();
        }

        Logger.info(`${C_HEX.green}Forced update complete.${C_HEX.reset}`);

        await exit();
    } else if (ARGV.creds) {
        // creds need setting up
        Logger.info(`${C_HEX.yellow}Running forced one-time credentials creation...${C_HEX.reset}`);

        Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

        LINEUP_SCHEDULER = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

        await LINEUP_SCHEDULER.runTask();

        Logger.info(`${C_HEX.green}Forced credentials creation complete.${C_HEX.reset}`);

        await exit();
    } else {
        // Then run the server.
        if (!FS.fileExists(CREDS_FILE)) {
            // creds need setting up
            Logger.info(`No creds file found. Lets log into your Tablo account.`);

            Logger.info(`${C_HEX.red}NOTE:${C_HEX.reset} Your password and email are never stored, but are transmitted in plain text.\nPlease make sure you are on a trusted network before you continue.`);

            await reqCreds();
        }

        if (process.stdin.isTTY) {
            console.log(`${C_HEX.yellow}-- Press '${C_HEX.green}x${C_HEX.yellow}' at anytime to exit.${C_HEX.reset}`);

            console.log(`${C_HEX.yellow}-- Press '${C_HEX.green}l${C_HEX.yellow}' at anytime to request a new channel lineup / guide.${C_HEX.reset}`);
        }

        try {
            await readCreds();

            LINEUP_SCHEDULER = new Scheduler(SCHEDULE_LINEUP, "Update channel lineup", LINEUP_UPDATE_INTERVAL, makeLineup);

            await LINEUP_SCHEDULER.scheduleNextRun();

            await parseLineup();

            if (CREATE_XML) {
                GUIDE_SCHEDULER = new Scheduler(SCHEDULE_GUIDE, "Update guide data", GUIDE_UPDATE_INTERVAL, cacheGuideData);

                await GUIDE_SCHEDULER.scheduleNextRun();
            }
        } catch (error) {
            Logger.error("Could not read lineup file. Check permissions and rerun app with --lineup.");

            return await exit();
        }

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            process.stdin.on('data', async (key) => {
                if (key.toString() == 'x' || key.toString() == 'X') { // x key
                    if (LINEUP_SCHEDULER) {
                        LINEUP_SCHEDULER.cancel();
                    }
                    if (GUIDE_SCHEDULER) {
                        GUIDE_SCHEDULER.cancel();
                    }
                    console.log(`${C_HEX.blue}Exiting Process...${C_HEX.reset}`);
                    setTimeout(() => {
                        process.exit(0);
                    }, 2000);
                } else if (key.toString() == "l" || key.toString() == "L") { // l key
                    if (LINEUP_SCHEDULER) {
                        await LINEUP_SCHEDULER.runTask();
                    }
                    if (GUIDE_SCHEDULER) {
                        await GUIDE_SCHEDULER.runTask();
                    }
                }
            });
        } else {
            Logger.info('Running as service - no interactive key controls.');
        }

        // Core function here
        runServer();
    }
})();