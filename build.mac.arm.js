/**
 * @file for creating an executable .exe file for windows.
 */

const exe = require("@hearhellacopters/exe");
const pak = require('./package.json');

const build = exe({
  entry: "./app.js",
  out: "./tablo2plex-macos-arm",
  pkg: ["-C", "GZip"], // Specify extra pkg arguments
  version: pak.version,
  target: "node18-macos-arm64",
  //icon: "./app.ico", // Application icons must be same size as prebuild target
  executionLevel: "highestAvailable",
  properties:{
        FileDescription: pak.description,
        ProductName: pak.name,
        OriginalFilename: pak.name,
        LegalCopyright: "MIT"
    }
});

build.then(() => console.log("Mac Arm build completed!"));