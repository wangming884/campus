FROM node:20-alpine

WORKDIR /app

# 1. 替换为阿里云 Alpine 镜像源（解决国外官方源下载慢、经常断流的问题）
# 2. 移除体积高达数百兆的 font-noto-cjk，仅保留轻量的文泉驿正黑 (font-wqy-zenhei，约15MB，完全满足中文排版需求)
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache \
    libreoffice \
    ttf-dejavu \
    font-wqy-zenhei

# 安装生产环境依赖（配置国内 npm 镜像源加速）
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --omit=dev

# 复制项目源代码
COPY . .

# 创建必要的上传与数据持久化目录
RUN mkdir -p uploads/templates uploads/submissions data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
