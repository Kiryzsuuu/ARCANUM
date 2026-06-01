@echo off
title ARCANUM — Setup & Launch
color 0A
cls

echo.
echo  ============================================================
echo   ARCANUM — SECURE COMMUNICATION PLATFORM
echo   Auto Setup ^& Launch
echo  ============================================================
echo.

:: ── 1. Cek Node.js ────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js tidak ditemukan!
    echo.
    echo  Silakan install Node.js dari:
    echo  https://nodejs.org  ^(pilih versi LTS^)
    echo.
    echo  Setelah install, jalankan start.bat lagi.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% ditemukan

:: ── 2. Cek npm ────────────────────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm tidak ditemukan. Reinstall Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo  [OK] npm v%NPM_VER% ditemukan

:: ── 3. Masuk ke folder project ────────────────────────────────
cd /d "%~dp0"
echo  [OK] Working directory: %CD%

:: ── 4. Setup .env ─────────────────────────────────────────────
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo  [SETUP] File .env dibuat dari .env.example
        echo.
        echo  ============================================================
        echo   PENTING: Buka file .env dan isi konfigurasi:
        echo   - MONGODB_URI  : connection string MongoDB Atlas
        echo   - SESSION_SECRET : string acak untuk keamanan session
        echo  ============================================================
        echo.
        echo  Tekan tombol apa saja setelah mengisi .env ...
        pause >nul
    ) else (
        echo  [WARN] File .env tidak ditemukan dan .env.example tidak ada.
        echo  Pastikan .env sudah diisi sebelum lanjut.
        echo.
        pause
    )
) else (
    echo  [OK] File .env ditemukan
)

:: ── 5. Install dependencies ───────────────────────────────────
if not exist "node_modules" (
    echo.
    echo  [INSTALL] Menginstall dependencies...
    echo  ^(Ini mungkin memakan waktu 1-2 menit pertama kali^)
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] npm install gagal. Cek koneksi internet.
        pause
        exit /b 1
    )
    echo  [OK] Dependencies terinstall
) else (
    :: Cek apakah package.json lebih baru dari node_modules
    for /f %%i in ('powershell -command "(Get-Item package.json).LastWriteTime -gt (Get-Item node_modules).LastWriteTime"') do set NEWER=%%i
    if "%NEWER%"=="True" (
        echo.
        echo  [UPDATE] package.json berubah, update dependencies...
        npm install
        echo  [OK] Dependencies diupdate
    ) else (
        echo  [OK] Dependencies sudah up-to-date
    )
)

:: ── 6. Jalankan server ────────────────────────────────────────
echo.
echo  ============================================================
echo   Menjalankan ARCANUM...
echo   Buka browser: http://localhost:3000
echo   Tekan Ctrl+C untuk menghentikan server
echo  ============================================================
echo.

:: Coba buka browser otomatis setelah 2 detik
start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Cek apakah nodemon tersedia (dev mode) atau pakai node biasa
where nodemon >nul 2>&1
if %errorlevel% equ 0 (
    echo  [MODE] Development ^(nodemon — auto-restart on file change^)
    echo.
    npx nodemon server.js
) else (
    echo  [MODE] Production ^(node^)
    echo.
    node server.js
)

echo.
echo  Server dihentikan.
pause
