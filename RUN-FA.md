# اجرای PortalC در ترمینال VS Code

پوشه `portalc` را با VS Code باز کنید. هیچ پنجره PowerShell جداگانه‌ای لازم نیست.

## اجرای بار اول

از منوی `Terminal > New Terminal` ترمینال داخلی VS Code را باز کنید و در ریشه پروژه اجرا کنید:

```text
dotnet restore OrgSystem.sln
SqlLocalDB start MSSQLLocalDB
dotnet ef database update --project OrgSystem.Infrastructure --startup-project OrgSystem.API
cd org-system-ui
npm install
cd ..
```

قبل از database update، اتصال SQL Server را در `OrgSystem.API/appsettings.json` تنظیم کنید.

## اجرای روزانه از خود VS Code

1. کلیدهای `Ctrl+Shift+P` را بزنید.
2. عبارت `Tasks: Run Task` را انتخاب کنید.
3. وظیفه `PortalC: Run All` را انتخاب کنید.

VS Code دو ترمینال داخلی باز می‌کند:

- Backend: `http://localhost:5043`
- Frontend: `http://localhost:5174`
- Swagger: `http://localhost:5043/swagger`

## اجرای دستی در دو ترمینال داخلی VS Code

ترمینال اول، در ریشه پروژه:

```text
dotnet run --project OrgSystem.API
```

ترمینال دوم:

```text
cd org-system-ui
npm run dev
```

## ورود اولیه

```text
Username: admin
Password: Admin@123
```

بعد از اولین ورود رمز مدیر را تغییر دهید.
