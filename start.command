#!/bin/bash

# ARCANUM — Auto Setup & Launch (Mac/Linux)
# Double-click file ini di Finder untuk menjalankan

# Warna terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Masuk ke folder tempat script ini berada
cd "$(dirname "$0")"

clear
echo ""
echo "  ============================================================"
echo -e "  ${CYAN}${BOLD} ARCANUM — SECURE COMMUNICATION PLATFORM${NC}"
echo "   Auto Setup & Launch"
echo "  ============================================================"
echo ""

# ── 1. Cek Node.js ────────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo -e "  ${RED}[ERROR]${NC} Node.js tidak ditemukan!"
    echo ""
    echo "  Install Node.js dengan salah satu cara:"
    echo ""
    echo "  Option A — Homebrew (recommended):"
    echo "    brew install node"
    echo ""
    echo "  Option B — Download installer:"
    echo "    https://nodejs.org  (pilih versi LTS)"
    echo ""
    echo "  Setelah install, jalankan start.command lagi."
    echo ""

    # Coba buka browser ke nodejs.org
    if command -v open &> /dev/null; then
        open "https://nodejs.org"
    fi

    read -p "  Tekan Enter untuk keluar..."
    exit 1
fi

NODE_VER=$(node -v)
echo -e "  ${GREEN}[OK]${NC} Node.js $NODE_VER ditemukan"

# ── 2. Cek npm ────────────────────────────────────────────────
if ! command -v npm &> /dev/null; then
    echo -e "  ${RED}[ERROR]${NC} npm tidak ditemukan. Reinstall Node.js."
    read -p "  Tekan Enter untuk keluar..."
    exit 1
fi

NPM_VER=$(npm -v)
echo -e "  ${GREEN}[OK]${NC} npm v$NPM_VER ditemukan"
echo -e "  ${GREEN}[OK]${NC} Working directory: $(pwd)"

# ── 3. Setup .env ─────────────────────────────────────────────
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
        echo -e "  ${YELLOW}[SETUP]${NC} File .env dibuat dari .env.example"
        echo ""
        echo "  ============================================================"
        echo -e "  ${YELLOW}${BOLD}  PENTING: Buka file .env dan isi konfigurasi:${NC}"
        echo "   - MONGODB_URI   : connection string MongoDB Atlas"
        echo "   - SESSION_SECRET: string acak untuk keamanan session"
        echo "  ============================================================"
        echo ""

        # Buka .env di text editor default
        if command -v open &> /dev/null; then
            open ".env"
        fi

        read -p "  Tekan Enter setelah mengisi .env ..."
    else
        echo -e "  ${YELLOW}[WARN]${NC} File .env tidak ditemukan dan .env.example tidak ada."
        read -p "  Tekan Enter untuk lanjut..."
    fi
else
    echo -e "  ${GREEN}[OK]${NC} File .env ditemukan"
fi

# ── 4. Install dependencies ───────────────────────────────────
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "  ${CYAN}[INSTALL]${NC} Menginstall dependencies..."
    echo "  (Ini mungkin memakan waktu 1-2 menit pertama kali)"
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "  ${RED}[ERROR]${NC} npm install gagal. Cek koneksi internet."
        read -p "  Tekan Enter untuk keluar..."
        exit 1
    fi
    echo -e "  ${GREEN}[OK]${NC} Dependencies terinstall"
else
    # Cek apakah package.json lebih baru dari node_modules
    if [ "package.json" -nt "node_modules" ]; then
        echo ""
        echo -e "  ${CYAN}[UPDATE]${NC} package.json berubah, update dependencies..."
        npm install
        echo -e "  ${GREEN}[OK]${NC} Dependencies diupdate"
    else
        echo -e "  ${GREEN}[OK]${NC} Dependencies sudah up-to-date"
    fi
fi

# ── 5. Jalankan server ────────────────────────────────────────
echo ""
echo "  ============================================================"
echo -e "  ${GREEN}${BOLD}  Menjalankan ARCANUM...${NC}"
echo "   Buka browser: http://localhost:3000"
echo "   Tekan Ctrl+C untuk menghentikan server"
echo "  ============================================================"
echo ""

# Buka browser otomatis setelah 2 detik
(sleep 2 && open "http://localhost:3000") &

# Jalankan dengan nodemon jika ada, fallback ke node
if npx --no nodemon --version &> /dev/null 2>&1; then
    echo -e "  ${CYAN}[MODE]${NC} Development (nodemon — auto-restart on file change)"
    echo ""
    npx nodemon server.js
else
    echo -e "  ${CYAN}[MODE]${NC} Production (node)"
    echo ""
    node server.js
fi

echo ""
echo "  Server dihentikan."
read -p "  Tekan Enter untuk keluar..."
