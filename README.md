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

Make sure you edit your `.env` file with your personal info. See the [Configuration](#configuration) section for available variables and command lines.

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

Make sure you edit your `.env` file with your personal info. See the [Configuration](#configuration) section for available variables and command lines.

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
|``DEVICE_ID``             | ``-f,--id``       | `string`  | Fake ID of the device for when you have more than one device on the network. Default `"12345678"` |
|``PORT``                  | ``-p,--port``     | `string`  | Change the port the app runs on (default ``8181``)|
|``LINEUP_UPDATE_INTERVAL``| ``-i,--interval`` | `string`  | How often the app will repopulate the channel lineup. Default once every ``30`` days. Can be triggered any time the proxy is running.|
|``CREATE_XML``            | ``-x,--xml``      | `boolean` | Creates an XML guide file from Tablo's data instead of letting Plex populate it with their data. Can take much longer to build and happens more often but is more accurate. Builds 2 days worth on content every day. Default ``false``|
|``GUIDE_DAYS``            | ``-d,--days``     | `number`  | The amount of days the guide will populate. The more days, the longer it will take to populate on update. Default ``2``, max ``7`` |
|``INCLUDE_PSEUDOTV_GUIDE``| ``-s,--pseudo``   | `boolean` | Due to issues with Plex not loading more than one EPG, you can include the guide data with your guide as long as it's at /.pseudotv/xmltv.xml. Default ``false``|
|``LOG_LEVEL``             | ``-g,--level``    | `string`  | The amount of data you would like to see in the console. `"debug", "warn", "error" or "info"`. Default ``error`` and lower|
|``SAVE_LOG``              | ``-k,--log``      | `boolean` | Create a file of all console output to the /logs folder. Default ``false``|
|``OUT_DIR``               | ``-o,--outdir``   | `string`  | Overide the output directory. Default is excution directory. (Disabled in `.env` by default) |
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

First clone the repo locally, then add a Dockerfile:

```
FROM node:20

WORKDIR /app

COPY package.json /app

# install required node modules
RUN npm install

# install ffmpeg
RUN apt update && apt install -y --no-install-recommends \
  ffmpeg \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY . /app

EXPOSE 8181

# create output directory (for mounted volume)
RUN mkdir /output

# set .env variables that can be overridden
ENV NAME="Tablo 4th Gen Proxy" \
    DEVICE_ID="12345678" \
    LINEUP_UPDATE_INTERVAL=30 \
    GUIDE_DAYS=2 \
    LOG_LEVEL="error" \
    SAVE_LOG="true" \
    USER_NAME="" \
    USER_PASS=""

CMD node app.js --name $NAME --id $DEVICE_ID --interval $LINEUP_UPDATE_INTERVAL --days $GUIDE_DAYS --level $LOG_LEVEL --log $SAVE_LOG --outdir /output --user $USER_NAME --pass $USER_PASS
```

Also add a .dockerignore file:

```
build.*.js
.git
.gitignore
node_modules
```

Build the image:

```
$ docker build -t tablo2plex .
```

Now build and run the container. in the Syno UI, it looks something like this:

<img src="./imgs/docker1.png" width="750">

Or a Docker compose.yaml file:

```
version: "3.8"
services:
  tablo2plex:
    container_name: tablo2plex
    image: tablo2plex
    environment:
       - USER_NAME=<tablo username>
       - USER_PASS=<tablo password>
    volumes:
      - /volume1/docker/tablo2plex/output:/output
    network_mode: synobridge
    ports:
      - 8182:8181/tcp
    restart: always
```

You can map the /output volume to a local folder so you can get to the log files and the other files (like creds.bin and the schedule_lineup.json) will persist across container builds:

<img src="./imgs/docker2.png" width="750">

You should have __Tablo2Plex__ running in a container! [Configure Plex](#plex-configuration) and point it to the URL/port of __Tablo2Plex__.

<img src="./imgs/docker3.png" width="750">

---

## License

MIT License

---

## Credits

Built with ❤️ by HearHellacopters 
