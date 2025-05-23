/**
 * @file for creating an executable .exe file for windows.
 */

const exe = require("@hearhellacopters/exe");
const pak = require('./package.json');

const build = exe({
  entry: "./app.js",
  out: "./tablo2plex-win-x64.exe",
  pkg: ["-C", "GZip"], // Specify extra pkg arguments
  version: pak.version,
  target: "node20-win-x64",
  icon: "./app.ico", // Application icons must be same size as prebuild target
  //executionLevel: "highestAvailable",
  properties:{
        FileDescription: pak.description,
        ProductName: pak.name,
        OriginalFilename: pak.name + ".exe",
        LegalCopyright: "MIT"
    }
});

build.then(() => console.log("Windows build completed!"));