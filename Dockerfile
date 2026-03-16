FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV PORT=3000
ENV APP_DATA_FILE=/var/data/tasks-db.json

EXPOSE 3000

CMD ["npm", "start"]
