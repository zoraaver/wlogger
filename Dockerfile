# base node image
FROM node:14 as builder
# Create app directory
WORKDIR /app
# copy both package json files
COPY package*.json ./
# install 3rd party packages
RUN npm install

# Bundle app source
COPY . .

# Compile ts files
RUN npx tsc --sourceMap false

# Remove all unnecessary files
RUN rm -rf @types *.json src

# run on port 80
EXPOSE 80

# set server to listen on port 80
ENV PORT="80"
ENV NODE_ENV="production"

# run server
CMD [ "node", "./dist/src/server.js" ]