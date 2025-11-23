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
ENV OUT_DIR="/output"

CMD ["node", "app.js"]
