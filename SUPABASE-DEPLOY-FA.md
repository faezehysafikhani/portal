# استقرار کامل بک‌اند روی Supabase

## معماری نهایی

- فرانت‌اند React روی Vercel
- PostgreSQL و Storage روی Supabase
- تمام APIها در `supabase/functions/api`
- دیتابیس از مرورگر قابل دسترسی نیست؛ فقط Edge Function با Service Role به آن دسترسی دارد.
- توکن ورود فعلی در Edge Function صادر می‌شود تا کاربران و رمزهای فعلی بدون ریست باقی بمانند.

## ۱. نکات امنیتی قبل از استقرار

رمز دیتابیس و JWT قبلی داخل تاریخچه Git بوده‌اند. از داشبورد Supabase رمز دیتابیس را عوض کنید و کلید قدیمی JWT برنامه را دیگر استفاده نکنید. `service_role` را هرگز در Vercel قرار ندهید.

دو مقدار تصادفی مستقل بسازید:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

اولی برای `EDGE_JWT_SECRET` و دومی برای `INTEGRATION_MASTER_KEY` است.

## ۲. نصب و اتصال Supabase CLI

```powershell
npm install --global supabase
supabase login
cd F:\portalC
supabase link --project-ref YOUR_PROJECT_REF
```

## ۳. اعمال migration امنیتی

قبل از این دستور از دیتابیس Backup بگیرید. migration، دسترسی مستقیم `anon` و `authenticated` به جدول‌ها را می‌بندد و bucketهای خصوصی را می‌سازد.

```powershell
supabase db push
```

## ۴. ثبت Secretهای Edge Function

دامنه اصلی Vercel و دامنه Previewهای موردنیاز را با کاما وارد کنید:

```powershell
supabase secrets set EDGE_JWT_SECRET="..."
supabase secrets set INTEGRATION_MASTER_KEY="..."
supabase secrets set ALLOWED_ORIGINS="https://YOUR-DOMAIN.vercel.app,http://localhost:5173"
```

`SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` در محیط Hosted Edge Functions به‌صورت پیش‌فرض موجودند.

## ۵. Deploy تابع

```powershell
supabase functions deploy api --no-verify-jwt
```

آزمون سلامت:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/api/api/v1/health
```

باید پاسخ `{"status":"ok","runtime":"supabase-edge"}` برگردد.

## ۶. تنظیم Vercel

در Project Settings > Environment Variables این مقدار را برای Production و Preview ثبت کنید:

```text
VITE_API_BASE_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/api
VITE_PUBLIC_APP_URL=https://YOUR-DOMAIN.vercel.app
```

سپس پروژه Vercel را Redeploy کنید. هیچ‌کدام از `SUPABASE_SERVICE_ROLE_KEY`، `EDGE_JWT_SECRET` یا `INTEGRATION_MASTER_KEY` نباید در Vercel ثبت شوند.

## ۷. تنظیم مجدد سرویس‌های خارجی

کلیدهای AI و پیامک قبلی با ASP.NET Data Protection رمز شده‌اند و Edge Function قادر به بازکردن آن‌ها نیست. پس از اولین ورود:

1. تنظیمات هوش مصنوعی را باز کنید و API Key را دوباره ذخیره کنید.
2. تنظیمات پیامک را باز کنید و API Key/Password را دوباره ذخیره کنید.

کلیدهای جدید با AES-GCM و `INTEGRATION_MASTER_KEY` رمز می‌شوند.

## ۸. آزمون پذیرش

به‌ترتیب ورود مدیر، فهرست کاربران، مخاطبان، وظایف، نامه‌ها، تیکت‌ها، فرم‌ها، تقویم، چت، گزارش‌ها، AI و پیامک را بررسی کنید. سپس با یک کاربر عادی مطمئن شوید اطلاعات tenant دیگر و منوهای بدون مجوز قابل مشاهده نیستند.

تا پایان این آزمون، سرویس ASP.NET قبلی را خاموش نکنید. بعد از تأیید، متغیر یا دامنه مربوط به آن را حذف کنید.

