@echo off
setlocal enabledelayedexpansion

REM Production deploy script (Windows).
REM Expects required secrets in the environment:
REM   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, WORKER_URL, ADMIN_TOKEN

set ROOT_DIR=%~dp0..
cd /d "%ROOT_DIR%" || exit /b 1

set MISSING=
for %%V in (CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID WORKER_URL ADMIN_TOKEN) do (
  if "%%!%%V!!"=="" (
    set MISSING=1
    echo Missing required env var: %%V
  )
)
if defined MISSING (
  echo.
  echo Set the missing env vars and re-run.
  exit /b 1
)

set "WORKER_URL_STRIPPED=%WORKER_URL%"
if "%WORKER_URL_STRIPPED:~-1%"=="/" set "WORKER_URL_STRIPPED=%WORKER_URL_STRIPPED:~0,-1%"
echo %WORKER_URL_STRIPPED% | findstr /i "^https\?://">nul
if errorlevel 1 (
  echo WORKER_URL must start with http:// or https://
  exit /b 1
)

echo Installing dependencies...
call npm ci || exit /b 1

echo Running tests...
call npm test || exit /b 1

echo Fetching runtime sources config...
powershell -NoProfile -Command ^
  "$headers = @{ Authorization = 'Bearer %ADMIN_TOKEN%' }; Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri '%WORKER_URL_STRIPPED%/admin/sources/export' -OutFile sources.runtime.json" || exit /b 1
node -e "JSON.parse(require('fs').readFileSync('sources.runtime.json','utf8'))" || exit /b 1

echo Generating banks...
call npm run gen --workspace @app/bank-gen -- --sources-config ../../sources.runtime.json || exit /b 1

echo Building packages...
call npm run build || exit /b 1
call npm run build --workspace @app/ui || exit /b 1

echo Deploying worker...
pushd packages\worker
call npx wrangler deploy || exit /b 1
popd

echo Uploading banks to KV...
call npx wrangler --config packages\worker\wrangler.toml kv:key put banks:discrete-math:latest:public --binding QUIZ_KV --path packages\bank-gen\dist\bank.public.v1.json || exit /b 1
call npx wrangler --config packages\worker\wrangler.toml kv:key put banks:discrete-math:latest:answers --binding QUIZ_KV --path packages\bank-gen\dist\bank.answers.v1.json || exit /b 1

echo Cleaning up runtime artifacts...
del /f /q sources.runtime.json >nul 2>&1
for /d /r %%D in (.tmp) do rmdir /s /q "%%D" >nul 2>&1

echo Done.
endlocal
