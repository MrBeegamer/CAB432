FROM node:22-bookworm

# Install ffmpeg for CPU-intensive processing
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
