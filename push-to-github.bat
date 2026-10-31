@echo off
chcp 65001 >nul
set REPO_URL=https://github.com/fut0r/ma5sos.git
if not "%~1"=="" set REPO_URL=%~1
if not exist ".git" (
  git init -b main
  git add -A
  git commit -m "تحديث المنصة بالكامل إلى مخصوص (Ma5sos) وإضافة الشعار الشفاف وإصلاح الأخطاء"
)
git remote set-url origin %REPO_URL% 2>nul || git remote add origin %REPO_URL%
git branch -M main
git push -u origin main --force
echo.
echo [✓] تم رفع المشروع بنجاح إلى GitHub!
pause
