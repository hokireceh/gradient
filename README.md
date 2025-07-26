
# 🚀 Gradient Network CLI

CLI tool untuk monitoring dan pengelolaan akun Gradient Network dengan interface bahasa Indonesia yang user-friendly.

![Gradient CLI](https://img.shields.io/badge/Gradient-CLI-blue?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

## ✨ Fitur Utama

- 👤 **Monitoring Profil** - Lihat statistik akun, poin, level, dan informasi lengkap
- 🖥️ **Sentry Node Management** - Monitor status dan performa node secara real-time
- 📡 **Analisis Latency** - Analisis mendalam performa jaringan dengan statistik detail
- 📢 **Pengumuman Terbaru** - Dapatkan update dan banner promosi dari Gradient Network
- 🔄 **Auto-Ping 24/7** - Sistem otomatis untuk menjaga koneksi tetap aktif
- 📊 **Status Monitoring** - Cek status sistem Gradient Network
- 🎨 **Interface Interaktif** - Menu navigasi yang mudah dengan warna dan emoji

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- NPM atau Yarn
- Token Bearer dari Gradient Network Extension

### Installation

1. **Clone atau download project ini**
2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup environment:**
   ```bash
   cp .env.example .env
   ```

4. **Edit file `.env` dan tambahkan token Anda:**
   ```env
   GRADIENT_TOKEN=your_bearer_token_here
   DEBUG=false
   COUNTRY=ID
   API_TIMEOUT=30000
   ```

5. **Jalankan CLI:**
   ```bash
   npm start
   # atau
   node index.js
   ```

## 🔑 Cara Mendapatkan Token

1. Buka browser dengan extension Gradient Network yang sudah login
2. Buka Developer Tools (F12)
3. Buka tab **Network**
4. Refresh halaman atau lakukan aksi di extension
5. Cari request ke `api.gradient.network`
6. Lihat header **Authorization** dan copy nilai setelah "Bearer "
7. Paste nilai tersebut ke `GRADIENT_TOKEN` di file `.env`

## 📋 Menu & Fitur

### 👤 Profil & Statistik
- Informasi akun lengkap (nama, email, kode referral)
- Statistik poin (total, saldo, withdraw, referral)
- Data season dan level
- Informasi node (sentry, work, duration)
- Social media terhubung

### 🖥️ Monitor Sentry Node
- Status node (online/offline)
- Uptime monitoring
- Points tracking
- Last seen timestamp

### 📡 Analisis Latency
- Statistik latency (avg, min, max)
- Historical data
- Performance analysis
- Location-based tracking

### 🔄 Auto-Ping 24/7
- Automatic connection keepalive
- 30-second ping intervals
- Error monitoring & auto-recovery
- Uptime statistics
- Node-specific monitoring

### 📢 Pengumuman
- Banner promosi terbaru
- Pengumuman system
- Version updates
- Formatted content display

## 🛠️ Configuration

File `.env` mendukung konfigurasi berikut:

```env
# Required
GRADIENT_TOKEN=your_bearer_token

# Optional
DEBUG=false              # Enable debug logging
COUNTRY=ID              # Country code for announcements  
API_TIMEOUT=30000       # API request timeout (ms)
```

## 📁 Project Structure

```
gradient-cli/
├── index.js              # Main CLI application
├── package.json           # Dependencies & scripts
├── .env.example          # Environment template
├── .env                  # Your environment config
├── logs/                 # Application logs
│   ├── gradient-cli.log  # General activity logs
│   └── errors.log        # Error logs
└── README.md             # This file
```

## 🔧 Troubleshooting

### Common Issues

**❌ "Token tidak valid atau sudah expired"**
- Dapatkan token baru dari browser extension
- Pastikan extension masih login
- Copy token lengkap tanpa spasi

**❌ "Cannot find module"**
- Jalankan `npm install` untuk install dependencies
- Pastikan Node.js versi 18+

**❌ Auto-ping error**
- Check koneksi internet
- Verify token masih valid
- Check API timeout settings

### Debug Mode

Enable debug logging:
```env
DEBUG=true
```

Logs tersimpan di folder `logs/`:
- `gradient-cli.log` - Activity logs
- `errors.log` - Error details

## 🌟 Advanced Usage

### Command Line Args

```bash
# Show help
node index.js --help

# Direct command execution
node index.js profil      # Show profile
node index.js node        # Show nodes
node index.js status      # Check status
```

### Auto-Ping Configuration

Auto-ping system features:
- **Interval**: 30 seconds
- **Endpoints**: Status + Node monitoring
- **Error handling**: Auto-stop after 5 consecutive errors
- **Recovery**: Manual restart available
- **Monitoring**: Real-time statistics

## 🙏 Support This Project

If you find this project helpful, you can support me via IDR USD or crypto ❤️

---
### ⚡ IDR (Rupiah)
- <b>[https://trakteer.id/garapanairdrop/tip](https://trakteer.id/garapanairdrop/tip)</b>

---

### ⚡ USD BNB ETH (EVM)
```bash
0x6ecc29eb11e73d12470bb80929d3a8f7b4e052ab
```

---

### ₿ Bitcoin (BTC)
```bash
bc1q6phfe0h6xjrhuhsrkhklvhspq6les85eardj8m
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).  
Feel free to use, modify, and distribute it for personal or commercial purposes — just include attribution.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

Jika mengalami masalah atau butuh bantuan:

1. Check [Troubleshooting](#-troubleshooting) section
2. Enable debug mode untuk detail error
3. Check logs di folder `logs/`
4. Buka issue di repository ini

---

**Made with ❤️ for Gradient Network Community**

> 💡 **Tip**: Gunakan auto-ping 24/7 untuk memaksimalkan earning dan menjaga koneksi tetap stabil!
