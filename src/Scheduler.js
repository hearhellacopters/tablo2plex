// @ts-check
const fs = require("fs");

const FS = require("./FS");
const JSDate = require('./JSDate');
const Logger = require('./Logger');

class Scheduler {
    interval = 0;
    taskFn = async () => { };
    nextCheck = "";
    schedulerFile = "";
    label = "Default task";
    MAX_TIMEOUT = 2147483647;
    /**
      * Sets a new scheduled time and task.
      * @param {string} schedulerFile JSON file to write the date.
      * @param {string} label The name of the task
      * @param {number} interval How often the task should run in milliseconds
      * @param {() => Promise<void>} taskFn The async task to run at the scheduled time.
      */
    constructor(schedulerFile, label, interval, taskFn) {
        this.schedulerFile = schedulerFile;

        this.label = label;

        this.taskFn = taskFn;

        this.timeoutId = null;

        if (!FS.fileExists(schedulerFile)) {
            this.interval = interval;

            this.nextCheck = JSDate.getRFC1123DateString();

            this._saveToFile();
        } else {
            const data = JSON.parse(fs.readFileSync(schedulerFile, 'utf8'));

            this.interval = data.interval;

            this.nextCheck = data.nextCheck;
        }

        if (isNaN(new Date(this.nextCheck).getTime())) {
            Logger.error("Invalid Scheduler time string:", this.nextCheck);

            this.nextCheck = JSDate.getRFC1123DateString();

            this._saveToFile();
        }
    }

    _saveToFile() {
        fs.writeFileSync(this.schedulerFile, JSON.stringify({
            interval: this.interval,
            nextCheck: this.nextCheck
        }, null, 4));
    }

    async scheduleNextRun() {
        const now = new Date().getTime();

        const next = new Date(this.nextCheck).getTime();

        if (now >= next) {
            await this.runTask();
        } else {
            const delay = next - now;

            Logger.info(`${this.label} scheduled for ${this.nextCheck}`);

            this._setTimeout(() => this.runTask(), delay);
        }
        return;
    }

    /**
     * @param {() => Promise<void>} callback 
     * @param {number} delay 
     */
    _setTimeout(callback, delay) {
        if (delay > this.MAX_TIMEOUT) {
            this.timeoutId = setTimeout(() => {
                const remaining = new Date(this.nextCheck).getTime() - new Date().getTime();

                this._setTimeout(callback, remaining);

            }, this.MAX_TIMEOUT);
        } else {
            this.timeoutId = setTimeout(callback, Math.max(0, delay));
        }
    }

    async runTask() {
        this.cancel();

        Logger.info(`Running ${this.label}...`);

        await this.taskFn();

        const now = new Date();

        this.nextCheck = JSDate.getRFC1123DateString(new Date(now.getTime() + this.interval).getTime());

        Logger.info(`${this.label} finished running. Next run scheduled for ${this.nextCheck}`);

        this._saveToFile();

        this._schedule();
        return;
    }

    _schedule() {
        const now = new Date().getTime();

        const next = new Date(this.nextCheck).getTime();

        const delay = Math.max(0, next - now);

        this._setTimeout(() => this.runTask(), delay);
        return;
    }

    cancel() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);

            this.timeoutId = null;
        }
        return;
    }
};

module.exports = Scheduler;