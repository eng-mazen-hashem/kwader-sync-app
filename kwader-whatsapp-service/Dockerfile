FROM node:18

# تحديث النظام وتثبيت متصفح الكروم رسمياً
RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*

# تحديد مجلد العمل
WORKDIR /app

# نسخ ملفات المشروع وتثبيت المكتبات
COPY package*.json ./
RUN npm install

# نسخ باقي الكود
COPY . .

# فتح المنفذ
EXPOSE 8080

# أمر التشغيل
CMD ["npm", "start"]
