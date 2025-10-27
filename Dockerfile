FROM docker pull node:alpine
WORKDIR /app
COPY package.json ./
COPY bun.lockb ./
COPY src ./
RUN npm install
EXPOSE 3000
CMD ["node","index.ts"]