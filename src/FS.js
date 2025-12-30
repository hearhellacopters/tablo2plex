// @ts-check
const fs = require('fs');
const path = require('path');

const {
    exit
} = require('./CommandLine');
const {
    C_HEX
} = require("./Constants");
const Logger = require('./Logger');

/**
 * Check if a directory exist.
 * 
 * @param {string} dir - Path to directory.
 * @returns {boolean} if exists
 */
function _directoryExists(dir) {
    if (fs.existsSync(dir)) {
        return true;
    };
    return false;
};

/**
 * Check if a file exist.
 * 
 * @param {string} filePath - Path to file to check.
 * @returns {boolean} if exists
 */
function _fileExists(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);

        return true;  // File exists
    } catch (error) {
        // @ts-ignore
        if (error.code === 'ENOENT') {
            return false;  // File does not exist
        } else {
            Logger.error(error); // Other errors

            return false;
        }
    }
};

/**
 * Creates a directory.
 * 
 * @param {string} dir - Path to directory.
 */
function _makeDirectory(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    };
};

/**
 * For reading and returning all local file paths in a directory
 * 
 * @param {string} dir - directory to check
 * @param {string} current_folder - Current folder
 * @param {{str:string}} current_string - Current string object
 * @param {string[]} current_array - array of local file paths
 */
function _increase_path(dir, current_folder, current_string, current_array) {
    var check = path.join(dir, current_folder);

    if (fs.statSync(check).isDirectory()) {
        current_string.str += current_folder + "/";

        const folders = fs.readdirSync(check);

        for (const key in folders) {
            if (Object.prototype.hasOwnProperty.call(folders, key)) {
                const context = folders[key];

                _increase_path(check, context, current_string, current_array);
            }
        }
    } else {
        current_array.push(current_string.str + current_folder);
    }
};

/**
 * Ensures that a given path exists as a file or directory.
 * 
 * Will write data if passed.
 * 
 * @param {string} targetPath - The path to check or create.
 * @param {any?} fileData - Data for the file
 */
function _ensurePathExists(targetPath, fileData) {
    const isFile = !!path.extname(targetPath);

    try {
        if (fs.existsSync(targetPath)) {
            const stats = fs.statSync(targetPath);
            // Path already exists as file, but we want folder
            if (!isFile && stats.isFile()) {
                fs.mkdirSync(targetPath, { recursive: true });

                return;
            }
        }
        // Path does not exist, create it
        if (!isFile) {
            // targetPath is a folder so create it
            fs.mkdirSync(targetPath, { recursive: true });
        } else if (isFile) {
            // targetPath is a file so make sure folder path is created
            const dir = path.dirname(targetPath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            if (fileData) {
                // writes file data if supplied
                fs.writeFileSync(targetPath, fileData);
            }
        }
    } catch (err) {
        Logger.error("Error checking path to write data.");

        Logger.error(targetPath);

        Logger.error(err)
    }
};

/**
 * File size short hand. Example: ``1.5kb``.
 * 
 * @param {number} bytes - Size
 * @returns {string} formatted
 */
function _formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' B';
    } else if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + 'kb';
    } else if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + 'mb';
    } else {
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'gb';
    }
};

/**
 * Loading bar function.
 * 
 * @param {number} totalSteps - total pos
 * @param {number} currentStep - current pos
 * @param {boolean|undefined} withSize - shows size of file as well
 * @returns {number}
 */
function _consoleLoadingBar(totalSteps, currentStep, withSize = false) {
    var barLength = 40;
    // Calculate the percentage completed
    const percentage = (currentStep / totalSteps) * 100;
    // Calculate the number of bars to display
    const bars = Math.floor((barLength * currentStep) / totalSteps);
    // Create the loading bar string
    const loadingBar = '[' + '='.repeat(bars) + '>'.repeat(bars < barLength ? 1 : 0) + ' '.repeat(barLength - bars) + ']';

    const message = `${C_HEX.green}${loadingBar}${C_HEX.reset} - ${percentage.toFixed(2)}%` + (withSize ? ` of ${_formatFileSize(totalSteps)} / ${_formatFileSize(currentStep)}` : ` - ${currentStep} of ${totalSteps}`);
    // Print the loading bar to the console
    if (process.stdout.isTTY) {
        process.stdout.clearLine(0);

        process.stdout.cursorTo(0);

        process.stdout.write(message);
    } else {
        process.stdout.write(message + '\n');  // Safe logging for service/journal
    }

    return 1;
};

/**
 * General file system static class.
 * 
 * For all file based operations.
 * @class
 */
class FS {

    /**
     * Test if a directory exists.
     * 
     * @static
     * @param {string} srcPath - Path to test. Do NOT include a file name.
     * @returns {boolean} if directory exists.
     */
    static directoryExists(srcPath) {
        return _directoryExists(srcPath);
    };

    /**
     * Test if a file directory exists.
     * 
     * @static
     * @param {string} srcPath - Full path to file including the file name.
     * @returns {boolean} if file exists.
     */
    static fileExists(srcPath) {
        return _fileExists(srcPath);
    };

    /**
     * Creates a path if one doesn't exist.
     * 
     * @static
     * @param {string} srcPath - Path to create. Do NOT include a file name.
     */
    static createDirectory(srcPath) {
        if (!_directoryExists(srcPath)) {
            _makeDirectory(srcPath);
        }
    };

    /**
     * Returns a list of all folders inside the given folder path.
     * 
     * Note: Not full path, just folder names.
     * 
     * ```js
     * [
     *   'folder1',
     *   'folder2',
     *   // etc
     * ]
     * ```
     * 
     * @static
     * @param {string} folderPath - The path of the folder to list subfolders from.
     * @param {boolean} fullPath - Returns full path and not just the folder names.
     * @returns {string[]} - An array of folder names inside the given folder.
     */
    static readDirectoryFolders(folderPath, fullPath = false) {
        try {
            const file = fs.readdirSync(folderPath);

            if (!fullPath) {
                return file.filter(item => {
                    const itemPath = path.join(folderPath, item);

                    return fs.statSync(itemPath).isDirectory();
                });
            } else {
                /**
                 * @type {string[]} 
                 */
                const list = [];

                file.forEach(item => {
                    const itemPath = path.join(folderPath, item);

                    if (fs.statSync(itemPath).isDirectory()) {
                        list.push(itemPath);
                    }
                });

                return list;
            }
        } catch (error) {
            // @ts-ignore
            Logger.error(`Error reading the folder: ${error.message}`);

            return [];
        }
    };

    /**
     * Returns a list of all files inside the given folder path.
     * 
     * ```js
     * [
     *  'file1.txt',
     *  'file2.txt',
     *  // etc
     * ]
     * ```
     * 
     * @static
     * @param {string} folderPath - The path of the folder to list files from.
     * @param {boolean} fullPath - Returns full path and not just the file names.
     * @param {string|undefined} only_type - Only return subfolders with this extension (include period).
     * @returns {string[]} - An array of file names inside the given folder.
     */
    static readDirectoryFiles(folderPath, fullPath = false, only_type = undefined) {
        try {
            const file = fs.readdirSync(folderPath);

            if (!fullPath) {
                return file.filter(item => {
                    const itemPath = path.join(folderPath, item);

                    const Ext = path.extname(itemPath);

                    if (only_type) {
                        return fs.statSync(itemPath).isFile() && Ext == only_type;
                    } else {
                        return fs.statSync(itemPath).isFile();
                    }
                });
            } else {
                /**
                 * @type {string[]} 
                 */
                const list = [];

                file.forEach(item => {
                    const itemPath = path.join(folderPath, item);

                    const Ext = path.extname(itemPath);

                    if (only_type) {
                        if (Ext == only_type && fs.statSync(itemPath).isFile()) {
                            list.push(itemPath);
                        }
                    } else if (fs.statSync(itemPath).isFile()) {
                        list.push(itemPath);
                    }
                });

                return list;
            }
        } catch (error) {
            // @ts-ignore
            Logger.error(`Error reading the folder: ${error.message}`);

            return [];
        }
    };

    /**
     * Returns all files with local path from supplied directory.
     * 
     * Note: Relative path to supplied directory.
     * 
     * ```js
     * [
     *   'folder1/file1.txt',
     *   'folder1/file2.txt',
     *   'folder2/file1.txt',
     *   'folder2/file2.txt',
     *   // etc
     * ]
     * ```
     * 
     * @static
     * @param {string} directory directory to return all file paths in
     * @returns {string[]} path to files
     */
    static readDirectoryAndFiles(directory) {
        const starting_folder = fs.readdirSync(directory);

        /**
         * @type {string[]} 
         */
        const finished_array = [];

        for (const key in starting_folder) {
            if (Object.prototype.hasOwnProperty.call(starting_folder, key)) {
                const folder = starting_folder[key];

                const str = { str: "" };

                _increase_path(directory, folder, str, finished_array);
            }
        }
        return finished_array;
    };

    /**
     * Deletes files in the specified directory that are NOT listed in the filenames array.
     *
     * @param {string} directory - The directory path where the files are located.
     * @param {string[]} filenames - An array of filenames to keep.
     */
    static deleteUnlistedFiles(directory, filenames) {
        // Read the contents of the directory
        fs.readdir(directory, (err, files) => {
            if (err) {
                Logger.error(`Error reading directory: ${err}`);

                return;
            }

            // Filter out the files that are not in the filenames array
            const filesToDelete = files.filter(file => !filenames.includes(file));

            // Delete those files
            filesToDelete.forEach(file => {
                const filePath = path.join(directory, file);

                fs.unlink(filePath, (err) => {
                    if (err) {
                        Logger.error(`Error deleting file ${filePath}: ${err}`);
                    }
                });
            });
        });
    }

    /**
     * Writes a file. Will create the directory if it doesn't exist.
     * 
     * @static
     * @param {Buffer|string|object} data - File data
     * @param {string} srcPath - Full path to file including the file name.
     * @throws {Error} if data is not writable.
     */
    static writeFile(data, srcPath) {
        // stringify if needed
        if (typeof data == "object" && !(data instanceof Buffer)) {
            data = JSON.stringify(data, null, 2);
        }
        
        if (data instanceof Buffer || typeof data == "string") {
            _ensurePathExists(srcPath, data);
        } else {
            Logger.error("Data supplied to be written was not in a JSON format");

            Logger.error(srcPath);
        }
    };

    /**
     * Loads a file and returns the ``Buffer``.
     * 
     * @static
     * @param {string} srcPath - Full path to file including the file name.
     * @returns {Buffer} Buffer of data
     * @throws {Error} if file doesn't exist
     */
    static readFile(srcPath) {
        const dir = path.dirname(srcPath);

        if (!_directoryExists(dir)) {
            Logger.error("Can not find folder to file being read: " + srcPath);

            exit();
        }

        if (!_fileExists(srcPath)) {
            Logger.error("Can not find file being read: " + srcPath);

            exit();
        }
        return fs.readFileSync(srcPath);
    };

    /**
     * Loads a JSON file and returns the object data.
     * 
     * @static
     * @param {string} srcPath - Full path to file including the file name.
     * @returns {any} data
     * @throws {Error} if file doesn't exist
     */
    static readJSON(srcPath) {
        const dir = path.dirname(srcPath);

        if (!_directoryExists(dir)) {
            Logger.error("Can not find folder to file being read: " + srcPath);
            
            exit();

            return;
        }

        if (!_fileExists(srcPath)) {
            Logger.error("Can not find file being read: " + srcPath);

            exit();

            return;
        }

        try {
            const buf = fs.readFileSync(srcPath);

            return JSON.parse(buf.toString());
        } catch (error) {
            Logger.error("Could not parse JSON data: " + srcPath);

            return {};
        }
    };

    /**
     * Writes a file. Will create the directory if it doesn't exist.
     * 
     * @static
     * @param {object|string|Buffer} data - Data is save (if Buffer or string than assumes it's been stringify)
     * @param {string} srcPath - Full path to file including the file name with .json ext.
     * @throws {Error} if data is not writable.
     */
    static writeJSON(data, srcPath) {
        this.writeFile(data, srcPath);
    };

    /**
     * Loading bar function. Use on each update
     * 
     * When completed, end with:
     * 
     * ```javascript
     * process.stdout.write('\n');
     * 
     * ```
     * 
     * @static
     * @param {number} totalSteps - total amount
     * @param {number} currentStep - current amount
     * @param {boolean|undefined} witchSize - Converts amounts to file size
     * @returns {number}
     */
    static loadingBar(totalSteps, currentStep, witchSize = false) {
        return _consoleLoadingBar(totalSteps, currentStep, witchSize);
    };
};

module.exports = FS;