// @ts-check
/**
 * @typedef {import('node:buffer').Buffer} Buffer
 */

require('dotenv').config();
const os = require('os');
const {
    createHmac,
    createHash,
    createCipheriv,
    createDecipheriv
} = require("crypto");

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

            this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253) + this.mti;
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

            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525)))  + init_key[j] + j; /* non linear */

            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */

            i++; 

            j++;

            if (i >= this.N) { 
                this.mt[0] = this.mt[this.N - 1]; 
                i = 1; 
            }

            if (j >= key_length){ 
                j = 0;
            }
        }

        for (k = this.N - 1; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);

            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941)) - i; /* non linear */

            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */

            i++;

            if (i >= this.N) { 
                this.mt[0] = this.mt[this.N - 1]; 
                i = 1; 
            }
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
        /* divided by 2^32-1 */
        return this.random_int() * (1.0 / 4294967295.0);
    }

    /**
     * generates a random number on [0,1)-real-interval
     * 
     * @returns {number} number
     */
    random() {
        /* divided by 2^32 */
        return this.random_int() * (1.0 / 4294967296.0);
    }

    /**
     * generates a random number on (0,1)-real-interva
     * 
     * @returns {number} number
     */
    random_excl() {
        /* divided by 2^32 */
        return (this.random_int() + 0.5) * (1.0 / 4294967296.0);
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
        const byte = parseInt(hexString.substring(i, i + 2), 16);

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
function _UUID(version = 4, options = {}, asBuffer = false) {
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
        } else {
            buff = seed;
        }
    } else {
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
            } else {
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
                } else {
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

/**
 * Encryption functions 
 */
class Encryption {
    /**
     * 
     * @param {string} creds - stringified creds
     * @returns {Buffer}
     */
    static crypt(creds) {
        const RSA = process.env.RSA == undefined ? "30818902818100B507AAAC6B6B1BA5CE02B8512381159ECFD9CD32D6EEADCAFF459EA7E2210819C2D915F437E30871DDA190F19B8898038E1E7863A21699CDA5BC6C84C49D935AFAFFE1D2F16B0C662DC8941D8751FB7A36AC22F5980EDF92FCF7756FC6FCFD967A73303C7CD7030C681799C18E0A2F2D2B69C9F7BD8ADE05731BB179F354F0E90203010001" : process.env.RSA;

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

        for (let i = 0; i < amount; i++) {
            mt.random_int();
        }

        const ivBuff = Buffer.alloc(16, 0);

        for (let i = 0; i < (16 / 4); i++) {
            ivBuff.writeUInt32LE(mt.random_int(), i * 4)
        };

        const cipher = createCipheriv("aes-256-cbc", keyBuff, ivBuff);

        cipher.setAutoPadding(true);

        cipher.write(creds);

        cipher.end();

        const encrypted = Buffer.concat([seedBuff, cipher.read()]);

        return encrypted;
    };

    /**
     * Check data with 0x7b
     * @param {Buffer} creds - file buffer of creds
     * @returns {Buffer}
     */
    static decrypt(creds) {
        const RSA = process.env.RSA == undefined ? "30818902818100B507AAAC6B6B1BA5CE02B8512381159ECFD9CD32D6EEADCAFF459EA7E2210819C2D915F437E30871DDA190F19B8898038E1E7863A21699CDA5BC6C84C49D935AFAFFE1D2F16B0C662DC8941D8751FB7A36AC22F5980EDF92FCF7756FC6FCFD967A73303C7CD7030C681799C18E0A2F2D2B69C9F7BD8ADE05731BB179F354F0E90203010001" : process.env.RSA;

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

        for (let i = 0; i < amount; i++) {
            mt.random_int()
        };

        const ivBuff = Buffer.alloc(16, 0);

        for (let i = 0; i < (16 / 4); i++) {
            ivBuff.writeUInt32LE(mt.random_int(), i * 4)
        };

        const cipher = createDecipheriv("aes-256-cbc", keyBuff, ivBuff);

        cipher.setAutoPadding(true);

        cipher.write(creds.subarray(4, creds.length));

        cipher.end();

        return cipher.read();
    };

     /**
     * For Tablo device signing
     * @param {string} method - POST, GET, PUT
     * @param {string} url - end directory url without params
     * @param {string} msg - content of message, use "" for none.
     * @param {string} date - Human readable string
     */
    static makeDeviceAuth(method, url, msg, date) {
        if (msg != "") {
            const MD5 = createHash("md5").update(msg);

            msg = MD5.digest('hex').toLowerCase();
        }
        const full_str = method + "\n" + url + "\n" + msg + "\n" + date;

        const key = process.env.HashKey == undefined ? "6l8jU5N43cEilqItmT3U2M2PFM3qPziilXqau9ys" : process.env.HashKey;

        const part2 = createHmac("md5", key).update(full_str);

        const device = process.env.DeviceKey == undefined ? "ljpg6ZkwShVv8aI12E2LP55Ep8vq1uYDPvX0DdTB" : process.env.DeviceKey;

        return "tablo:" + device + ":" + part2.digest('hex').toLowerCase();
    };

    /**
     * Generates a UUID as Hex string.
     */
    static UUID(){
        return _UUID();
    }
};

module.exports = Encryption;