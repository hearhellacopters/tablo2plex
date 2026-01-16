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
    CREATE_XML="false" \
    GUIDE_DAYS=2 \
    INCLUDE_PSEUDOTV_GUIDE="false" \
    LOG_LEVEL="error" \
    SAVE_LOG="true" \
    USER_NAME="user" \
    USER_PASS="pass" \
    GUIDE_UPDATE_INTERVAL=24 \
    INCLUDE_OTT="true"

CMD node app.js --name $NAME --id $DEVICE_ID --interval $LINEUP_UPDATE_INTERVAL --xml $CREATE_XML --days $GUIDE_DAYS --pseudo $INCLUDE_PSEUDOTV_GUIDE --level $LOG_LEVEL --log $SAVE_LOG --outdir /output --user $USER_NAME --pass $USER_PASS --guide $GUIDE_UPDATE_INTERVAL --ott $INCLUDE_OTT
