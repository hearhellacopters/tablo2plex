// @ts-check
const keypress = require('keypress');
const {
    confirm,
    checkbox,
    select,
    password,
    Separator,
    input: inputs
} = require('@inquirer/prompts');

const {
    C_HEX,
} = require('./Constants');
const Logger = require('./Logger');

/**
 * A press any key to exit function.
 * 
 * @async
 */
async function exit() {
    // Just exit when runnning as a service
    if (!process.stdin.isTTY) {
        Logger.info(`${C_HEX.blue}Exiting Tablo2Plex...${C_HEX.reset}`);
        
        process.exit(0);
    }
    // Enable keypress events on stdin
    keypress(process.stdin);

    console.log('Press any key to exit...');

    /**
     * Create a promise to handle key press
     * @returns {Promise<any>} Promise
     */
    function getKeyPress() {
        return new Promise(resolve => {
            var pressed = true;

            process.stdin.on('keypress', (_, key) => {
                if (pressed && key) {
                    pressed = false;

                    console.log("Exiting...");

                    setTimeout(() => {
                        process.exit(0);
                    }, 2000);
                }
            });
            // Set raw mode to capture all key events
            process.stdin.setRawMode(true);

            process.stdin.resume();
        });
    }
    // Wait for key press
    await getKeyPress();
    // Clean up keypress events
    process.stdin.setRawMode(false);

    process.stdin.pause();
};

/**
 * Ask for input based on question. Input can't be blank.
 * 
 * Example:
 * 
 * ```
 * input("What is your name?").then(answer=>{
 *      if(answer){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} question - Question to ask.
 * @param {boolean} isPassword - if the input needs to be masked
 * @returns {Promise<string>} Promise
 */
async function input(question, isPassword = false) {
    const questions = {
        message: question,
        required: true,
    };

    return new Promise((resolve, reject) => {
        try {
            if (isPassword) {
                password(questions).then(answer => {
                    resolve(answer);
                });
            } else {
                inputs(questions).then(answer => {
                    resolve(answer);
                });
            }
        } catch (error) {
            reject();
        }
    });
};

/**
 * Ask a yes / no question.
 * 
 * Example:
 * 
 * ```
 * ask("Continue?").then(answer=>{
 *      if(answer){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} question - Question to ask.
 * @returns {Promise<boolean>} Promise
 */
async function ask(question) {
    const questions = {
        type: 'confirm',
        message: question,
        defalt: false
    };

    return new Promise((resolve, reject) => {
        try {
            confirm(questions).then(answer => {
                resolve(answer);
            });
        } catch (error) {
            reject();
        }
    });
};

/**
 * An input of multi select checkboxes (multi select).
 * 
 * Example:
 * 
 * ```
 * const questions = [
 *    {
 *        value: 'Extra Cheese'
 *    },
 *    {
 *        value: 'Pepperoni'
 *    }
 * ]
 * select("What would you like on your pizza?", questions).then(answers=>{
 *      if(answers){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} title - Title of the selection.
 * @param {{value: string, disabled?: boolean | string, description?: string }[]} questions - Array of answers to select.
 * @returns {Promise<string[]>} Promise
 */
async function selects(title, questions) {

    const new_array_of_questions = questions.map((question) => {
        if (question.value == undefined) {
            return new Separator();
        } else {
            return question;
        }
    });

    const question = {
        message: title + "\n",
        choices: new_array_of_questions,
        required: true,
    };

    return new Promise((resolve, reject) => {
        try {
            checkbox(question).then(answer => {
                resolve(answer);
            });
        } catch (error) {
            reject();
        }
    });
};

/**
 * An input of a single select list (single selection).
 * 
 * Example:
 * 
 * ```
 * const questions = [
 *    {
 *        value: 'Extra Cheese'
 *    },
 *    {
 *        value: 'Pepperoni'
 *    }
 * ]
 * choose("What would you like on your pizza?", questions).then(answers=>{
 *      if(answers){
 *      //do something
 *      }
 * }).catch(err=>{
 *      //error catch
 * })
 * ```
 * 
 * @async
 * @param {string} title - Title of the selection.
 * @param {{value: string, disabled?: boolean | string, description?: string }[]} questions - Array of answers to select.
 * @returns {Promise<string>} Promise
 */
async function choose(title, questions) {

    const new_array_of_questions = questions.map((question) => {
        if (question.value == undefined) {
            return new Separator();
        } else {
            return question;
        }
    });

    const question = {
        message: title,
        choices: new_array_of_questions,
        required: true,
    };

    return new Promise((resolve, reject) => {
        try {
            select(question).then(answer => {
                resolve(answer);
            });
        } catch (error) {
            reject();
        }
    });
};

module.exports = {
    exit,
    input,
    ask,
    selects,
    choose
};