FROM node:20-alpine3.19
ENV NODE_ENV=production

WORKDIR /app
COPY . .

RUN npm ci --production

CMD ["node", "./bin/www.js"]