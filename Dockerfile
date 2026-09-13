FROM node:20-alpine

WORKDIR /app

# 安装生产环境依赖
COPY package*.json ./
RUN npm install --omit=dev

# 复制项目源代码
COPY . .

# 创建必要的上传与数据持久化目录
RUN mkdir -p uploads/templates uploads/submissions data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
