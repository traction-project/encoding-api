FROM troeggla/node-traction-mediavault:alpine-3.11

HEALTHCHECK --start-period=30s CMD ["curl", "-f", "http://localhost:3000/revision"]

ADD . /code/
WORKDIR /code

COPY --from=frontend /code public/

RUN yarn install && \
    yarn build && \
    yarn cache clean --all

EXPOSE 3000
CMD ["yarn", "start"]
