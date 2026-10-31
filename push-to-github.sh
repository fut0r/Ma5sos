#!/usr/bin/env bash
set -e
REPO_URL="${1:-https://github.com/fut0r/ma5sos.git}"
if [ ! -d ".git" ]; then
  git init -b main
  git add -A
  git commit -m "تحديث المنصة بالكامل إلى مخصوص (Ma5sos) وإضافة الشعار الشفاف وإصلاح الأخطاء"
fi
git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"
git branch -M main
git push -u origin main --force
echo "✓ تم رفع المشروع بنجاح إلى $REPO_URL"
