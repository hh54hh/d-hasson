# مشروع PAW - تعليمات الإعداد

## متطلبات النظام

- Node.js (الإصدار 18 أو أحدث)
- npm أو yarn أو pnpm

## خطوات الإعداد

### 1. إنشاء مجلد المشروع

```bash
mkdir paw-inventory-app
cd paw-inventory-app
```

### 2. إنشاء package.json

انسخ محتوى package.json من الملفات المرفقة

### 3. تثبيت التبعيات

```bash
npm install
```

### 4. إنشاء هيكل المجلدات

```
paw-inventory-app/
├── src/
│   ├── components/
│   │   └── ui/
│   ├── lib/
│   ├── pages/
│   ├── hooks/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── public/
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── postcss.config.js
└── components.json
```

### 5. نسخ الملفات

انسخ محتوى جميع الملفات من القائمة أدناه

### 6. تشغيل المشروع

```bash
npm run dev
```

## قائمة الملفات المطلوبة:

### ملفات التكوين الأساسية:

- ✅ package.json
- ✅ vite.config.ts
- ✅ tailwind.config.ts
- ✅ tsconfig.json
- ✅ tsconfig.app.json
- ✅ tsconfig.node.json
- ✅ postcss.config.js
- ✅ components.json
- ✅ index.html

### ملفات التطبيق الأساسية:

- ✅ src/main.tsx
- ✅ src/App.tsx
- ✅ src/index.css
- ✅ src/vite-env.d.ts

### ملفات الصفحات:

- ✅ src/pages/Login.tsx
- ✅ src/pages/Dashboard.tsx
- ✅ src/pages/NotFound.tsx

### ملفات المكتبات والأدوات:

- ✅ src/lib/types.ts
- ✅ src/lib/storage.ts
- ✅ src/lib/utils.ts

### مكونات واجهة المستخدم:

- ✅ src/components/ui/Layout.tsx
- ✅ src/components/ui/button.tsx
- ✅ src/components/ui/card.tsx
- ✅ src/components/ui/input.tsx
- ✅ src/components/ui/badge.tsx
- ✅ src/components/ui/alert-dialog.tsx
- ✅ src/hooks/use-toast.ts

## ملاحظات مهمة:

- التطبيق يعمل بدون إنترنت (Offline)
- رمز الدخول: 112233
- يدعم اللغة العربية واتجاه RTL
- يعمل على جميع الأجهزة (Responsive)

## المشاكل الشائعة:

1. إذا لم تعمل الخطوط العربية، تأكد من الاتصال بالإنترنت لتحميل Google Fonts
2. إذا ظهرت أخطاء TypeScript، تأكد من تثبيت جميع التبعيات
3. إذا لم تعمل الأيقونات، تأكد من تثبيت lucide-react

هل تريد مني إنشاء جميع الملفات مرة واحدة؟
