FROM node:18.9.0-alpine3.16

RUN apk add --no-cache yarn curl
HEALTHCHECK --start-period=30s CMD ["curl", "-f", "http://localhost:3000/revision"]

WORKDIR /code

ADD package.json yarn.lock /code/
RUN yarn install && \
    yarn cache clean --all

ADD . /code/
RUN yarn build

EXPOSE 3000
CMD ["yarn", "start"]
