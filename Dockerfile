# ใช้ Bun official image
FROM node:alpine3.24

# ตั้ง working directory
WORKDIR /app

# คัดลอกไฟล์ dependency ก่อน (เพื่อให้ Docker cache การติดตั้งได้)
COPY  package.json ./

# ติดตั้ง dependencies
RUN npm install

# คัดลอกซอร์สโค้ดทั้งหมด
COPY . .

# เปิดพอร์ต 3000
EXPOSE 3000

# รันแอป (Bun รองรับ TypeScript โดยตรง ไม่ต้อง build)
CMD ["npm", "run", "dev"]
