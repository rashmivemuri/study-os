@echo off
REM StudyOS uploader — double-click this file (no typing needed).
REM First ever run needs: a GitHub repo + remote (see README "Deploy" section).
cd /d "%~dp0"
git add -A
git diff --cached --quiet
if %errorlevel%==0 (
  echo Nothing new to upload.
  goto :push
)
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmm"') do set TS=%%t
git commit -m "StudyOS update %TS%"
:push
echo Uploading...
git push origin main
if %errorlevel%==0 (
  echo.
  echo Done - your live link refreshes in about a minute.
  timeout /t 6 >nul
) else (
  echo.
  echo Push failed - first run? Create the repo and set the remote, see README "Deploy".
  pause
)
