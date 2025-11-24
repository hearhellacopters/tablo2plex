# Tablo2Plex: HDHomeRun Proxy for Tablo TV (4th Gen)

<img src="./imgs/logo.png" width="200">

__Tablo2Plex__ is a Node.js-based server app that emulates an HDHomeRun device to allow Plex to access live TV streams from a Tablo 4th Gen device. It dynamically proxies Tablo's M3U8 `.ts` segment streams and serves them in a format Plex understands, enabling live playback and DVR functionality within Plex.

## Features

- 🧠 Emulates HDHomeRun's API (`discover.json`, `lineup.json`, etc.)
- 🔁 Parses dynamic M3U playlists from Tablo on demand
- 🎥 Streams `.ts` segments using FFmpeg via a unified stream endpoint
- 📺 Compatible with Plex Live TV & DVR interface
- 🔒 Encrypts your personal credentials
- 📃 Can also include your PseudoTV EPG as well!

## Table of Contents

- [Preface](#preface)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Node process](#node-process)
  - [Built App](#built-app)
- [Proxy Setup](#proxy-setup)
  - [Proxy Configuration](#proxy-configuration)
  - [Plex Configuration](#plex-configuration)
- [Docker Configuration](#docker-configuration) (experimental)

## Preface

With the Tablo 4th Gen devices, they added an Auth layer to their communications so you can't independently interact with them on your network. You are now forced to use only the official Tablo 4th Gen apps that are either poorly supported or non existent (see Windows). I wanted to not only fix that but expand the devices it supports while allowing you to take your streams with you wherever you go. That's how __Tablo2Plex__ was born! You can now use your Tablo device on any device that supports Plex, anywhere you go with it!

How it works:

<img src="./imgs/chart.png" width="750">

## Getting Started

### Prerequisites

- Node.js (to build, or use the pre-built app in [releases](https://github.com/hearhellacopters/tablo2plex/releases))
- FFmpeg installed and in your system path (included in [releases](https://github.com/hearhellacopters/tablo2plex/releases))
- Tablo account in good standing with a Tablo TV 4th Gen device on your local network, completely set up and activated
- Plex account with Plex Pass

## Installation

### Node Process

It's recommended that __Tablo2Plex__ runs on the same device as your Plex server for best performance. But as long as it's on the same network as both the Plex server and the Tablo device, it will work.

If you want to run the proxy a Node package:

```bash
git clone https://github.com/hearhellacopters/tablo2plex.git
cd tablo2plex
npm install
node app.js # or
npm run start
```

Make sure you edit your `.env` file with your personal info. See the [Configuration](#proxy-configuration) section for available variables and command lines.

---

### Built App

If you want to run the proxy as a pre-built app, check out the [releases page](https://github.com/hearhellacopters/tablo2plex/releases) and simply download it there. Can you also build your own with:

```bash
npm run build:win # or
npm run build:linux # or
npm run build:mac:arm # or
npm run build:mac:x64
```

**Note: Don't build for a system you aren't currently running.** Mac needs code signing and that is only possible on a Mac machine.

Make sure you edit your `.env` file with your personal info. See the [Configuration](#proxy-configuration) section for available variables and command lines.

## Proxy Setup

When you first run the proxy, you will be asked to log into your Tablo account by providing your email and password. **Note: Your email and password are never stored locally and all returned credentials are stored encrypted.** But when you first log in, your password and email is transmitted in plain text (nice one Tablo). So please don't setup the proxy on an untrusted network. 

It will ask you to select a profile or device if there is more than one on your account. Once done, it will download the channel lineup and start the proxy.

Besides the ``.env`` settings, you can run the proxy with a command line to force or overide some actions: 

### Proxy Configuration

Use the ``.env`` file to set the options you would like to use with the Tablo device and proxy. You can also pass them as a command line at start.

| `.env` Variable          | Commandline       | Type      | Desc    |
| :---                     | :---              | :---:     | :---    |
| ``-none-``               | ``-c,--creds``    | `boolean` | Force the app to ask for a login again to create new credentials files (Checks every time the app runs) |
| ``-none-``               | ``-l,--lineup``   | `boolean` | Force the app to pull a new channel line up from the Tablo servers. (Can be done at anytime while running.) |
|``NAME``                  | ``-n,--name``     | `string`  | Name of the device that shows up in Plex. Default `"Tablo 4th Gen Proxy"` |
|``DEVICE_ID``             | ``-f,--id``       | `string`  | Fake ID of the device for when you have more than one device on the network. Default `"12345679"` |
|``PORT``                  | ``-p,--port``     | `string`  | Change the port the app runs on (default ``8181``)|
|``LINEUP_UPDATE_INTERVAL``| ``-i,--interval`` | `string`  | How often the app will repopulate the channel lineup. Default once every ``30`` days. Can be triggered any time the proxy is running.|
|``CREATE_XML``            | ``-x,--xml``      | `boolean` | Creates an XML guide file from Tablo's data instead of letting Plex populate it with their data. Can take much longer to build and happens more often but is more accurate. Builds 2 days worth on content every day. Default ``false``|
|``GUIDE_DAYS``            | ``-d,--days``     | `number`  | The amount of days the guide will populate. The more days, the longer it will take to populate on update. Default ``2``, max ``7`` |
|``INCLUDE_PSEUDOTV_GUIDE``| ``-s,--pseudo``   | `boolean` | Due to issues with Plex not loading more than one EPG, you can include the guide data with your guide as long as it's at /.pseudotv/xmltv.xml. Default ``false``|
|``LOG_LEVEL``             | ``-g,--level``    | `string`  | The amount of data you would like to see in the console. `"debug", "warn", "error" or "info"`. Default ``error`` and lower|
|``SAVE_LOG``              | ``-k,--log``      | `boolean` | Create a file of all console output to the /logs folder. Default ``false``|
|``OUT_DIR``               | ``-o,--outdir``   | `string`  | Overide the output directory. Default is excution directory. (Disabled in `.env` by default) |
|``TABLO_DEVICE``          | ``-v,--device``   | `string`  | Server ID of the Tablo device to use if you have more than one on your account. (Disabled in `.env` by default)  |
|``USER_NAME``             | ``-u,--user``     | `string`  | Username to use for when creds.bin isn't present. (Disabled in `.env` by default) |
|``USER_PASS``             | ``-w,--pass``     | `string`  | Password to use for when creds.bin isn't present. (Disabled in `.env` by default) |

### Plex Configuration

1. Open Plex and go to **Live TV & DVR > Setup**
2. Plex should detect the device proxy automatically, if not you can add the displaying http address and port from the proxy.
3. Follow the guide scan using a ZIP code or use the displaying XML endpoint instead
4. Start watching live TV via Tablo!

*The 4th Gen Tablo devices no longer populate the channel guide through the device. The Tablo apps connects to a 3rd party that populates it within the Tablo app so it can control the DRV and many other features. If you are interested in keeping things simple, use the Plex's guide data instead of creating an XML guide yourself.

## Docker Configuration

*Note: Support here is experimental.*

First, clone the repo locally to a machine where you have Docker and Node.js installed. The Dockerfile and .dockerignore files for building the image are included in the project. Inside the cloned directory, build the tablo2plex image:

```
$ docker build -t tablo2plex .
```

This process will create a Node.js-based image with the required additional modules and ffmpeg installed to support tablo2plex. Now build and run the container via the [Docker run](https://docs.docker.com/reference/cli/docker/container/run/) command-line:

```
$ docker run -d -v ./output:/output -e USER_NAME=<your Tablo username> -e USER_PASS=<your Tablo password> tablo2plex
```

If everything goes right and the container starts, you should see files in your ./output directory (or whatever directory you mounted to the /output volume for the container), including the logs subdirectory. The log should show something like this:

```
[info] No creds file found. Lets log into your Tablo account.
[info] NOTE: Your password and email are never stored, but are transmitted in plain text.
Please make sure you are on a trusted network before you continue.
[info] Loggin was accepted!
[info] Using profile Profile 1
[info] Using device Tablo SID_<sid> @ http://192.168.1.134:8887
[info] Getting account token.
[info] Account token found!
[info] Connecting to device.
[info] Found Tablo 4G DUAL 128GB with 2 max tuners found!
[info] Credentials successfully created!
[info] Credentials successfully encrypted! Ready to use the server!
[info] Requesting a new channel lineup file!
[info] Successfully created new channel lineup file!
[info] Update channel lineup finished running. Next run scheduled for Mon, 17 Nov 2025 18:33:25 GMT
[info] Server v0.9.3 is running on http://172.17.0.2:8181 with 2 tuners
```

You can override additional environment variables by adding more `-e` parameters to the Docker command-line (ex. `-e GUIDE_DAYS=7 -e LOG_LEVEL=debug`). Once the creds.bin file is created with your encypted TabloTV credentials, you no longer need to specify the USER_NAME and USER_PASS parameters (this will also prevent your credentials from showing up on the command-line in a process list: the defaults of 'user' and 'pass' will appear but the program won't actually try to use them since the creds.bin file is already present).

Instead of the Docker command-line, you can also use a [Docker compose](https://docs.docker.com/reference/cli/docker/compose/) file. An [example YAML file](docker-compose-example.yaml) is included in the repo. Modify it for your particular environment and then use it to build and run the container:

```
$ docker compose -f compose.yaml up -d
```

Like with the command-line approach, once your creds.bin file is present in the mounted /output volume, you can remove the USER_NAME and USER_PASS values from the file if you wish.

Running in Container Manager on a Synology NAS, it looks something like this:

##### Creating the container
<img src="./imgs/docker1.png" width="750"/>

##### Mounted volume
<img src="./imgs/docker2.png" width="750">

##### Container logs
<img src="./imgs/docker3.png" width="750">

You should now have __Tablo2Plex__ running in a Docker container! [Configure Plex](#plex-configuration) and point it to the URL/port of __Tablo2Plex__.

---

## License

MIT License

---

## Credits

Built with ❤️ by HearHellacopters 
