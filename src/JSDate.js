// @ts-check

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
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                // Logger.error("Date must be an instanceof new Date()");

                date = new Date();
            }
        } else {
            date = new Date();
        };

        /**
         * @type {Intl.DateTimeFormatOptions}
         */
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZone: timeZone,
            timeZoneName: 'short' // Includes "EST" or "EDT"
        };

        return date.toLocaleString('en-US', options);
    }

    /**
     * RFC 1123 type date for headers
     * 
     * @static 
     * @param {string|number|Date|undefined} date
     * @returns {string}
     */
    static deviceDate(date = undefined){
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
                //Logger.error("Date must be an instanceof new Date()");

                date = new Date();
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
        var date = new Date(dateString);

        if (isNaN(date.getTime())) {
            // Logger.error('Invalid date string');

            date = new Date();
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
                // Logger.error("Date must be an instanceof new Date()");

                date = new Date();
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
                // Logger.error("Date must be an instanceof new Date()");

                date = new Date();
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
    static getDaysFromNumber(date, days = 0) {
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                //Logger.error("Date must be an instanceof new Date()");

                date = new Date();
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
    static getDaysFromString(date, days = 0) {
        if (date != undefined) {
            if (typeof date == "string" ||
                typeof date == "number"
            ) {
                date = new Date(date);
            } else if (!(date instanceof Date)) {
                //Logger.error("Date must be an instanceof new Date()");

                date = new Date();
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

module.exports = JSDate;