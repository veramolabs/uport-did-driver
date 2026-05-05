FROM cgr.dev/chainguard/node:latest-dev AS build
WORKDIR /uport-did-driver
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@10 --activate && corepack pnpm install --prod --frozen-lockfile

FROM cgr.dev/chainguard/node:latest
LABEL maintainer="Mircea NISTOR <work@mirceanis.xyz>"
LABEL repository="git+ssh://git@github.com/veramolabs/uport-did-driver.git"

WORKDIR /uport-did-driver
COPY --from=build /uport-did-driver/node_modules ./node_modules
COPY LICENSE README.md ./
COPY src/ ./src/

EXPOSE 8081

ENTRYPOINT ["node", "/uport-did-driver/src/server.js"]
