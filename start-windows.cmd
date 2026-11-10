@echo off
setlocal
cd /d "%~dp0" || goto :failed

set "VITE_API_PROXY_TARGET=http://100.75.215.11:5173"
set "VITE_SYNC_BACKEND=true"

where node.exe >nul 2>&1 || goto :node_required
where npm.cmd >nul 2>&1 || goto :node_required
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major < 22 || (major === 22 && minor < 12) ? 1 : 0);"
if errorlevel 1 goto :node_required

echo Checking the school server at %VITE_API_PROXY_TARGET% ...
node -e "fetch(process.env.VITE_API_PROXY_TARGET + '/api/v1/users/me', { signal: AbortSignal.timeout(5000) }).then(async response => { if (response.status !== 401 || (await response.json()).error?.code !== 'TOKEN_REQUIRED') throw new Error('Unexpected response: HTTP ' + response.status); }).catch(error => { console.error(error.cause || error.message); process.exitCode = 1; });"
if errorlevel 1 goto :server_unreachable

set "INSTALL_MARKER=node_modules\.rezero-package-lock.json"
if not exist "node_modules\.bin\electron.cmd" goto :install
if not exist "node_modules\.bin\vite.cmd" goto :install
if not exist "%INSTALL_MARKER%" goto :install
fc /b package-lock.json "%INSTALL_MARKER%" >nul 2>&1
if not errorlevel 1 goto :launch

:install
echo Installing project dependencies. This may take a few minutes.
call npm.cmd ci
if errorlevel 1 goto :failed
copy /y package-lock.json "%INSTALL_MARKER%" >nul
if errorlevel 1 goto :failed

:launch
echo Starting RE:ZERO Electron ...
call npm.cmd run electron:dev -- --kill-others --success first
if errorlevel 1 goto :failed
exit /b 0

:node_required
echo Install Node.js 22.12.0 or newer with npm, then run this script again.
goto :failed

:server_unreachable
echo Turn on Tailscale and ask the school server administrator to allow this PC on TCP port 5173.
where tailscale.exe >nul 2>&1
if not errorlevel 1 tailscale ip -4

:failed
echo RE:ZERO could not start. See the message above.
pause
exit /b 1
