FROM node:18.9.0-alpine3.16
HEALTHCHECK --start-period=30s CMD ["curl", "-f", "http://localhost:3000/revision"]

RUN apk add --no-cache yarn

ADD . /code/
WORKDIR /code

RUN yarn install && \
    yarn build && \
    yarn cache clean --all

EXPOSE 3000
CMD ["yarn", "start"]
