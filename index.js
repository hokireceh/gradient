
const chalk = require('chalk');
const figlet = require('figlet');
const inquirer = require('inquirer');
const axios = require('axios');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ===== UTILITY FUNCTIONS =====

// Logger utility
const logger = {
  logDir: './logs',
  logFile: path.join('./logs', 'gradient-cli.log'),
  errorFile: path.join('./logs', 'errors.log'),

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  },

  log(message, level = 'INFO') {
    this.ensureLogDir();
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  },

  logActivity(activity) {
    this.log(`Activity: ${activity}`, 'ACTIVITY');
  },

  logError(command, error) {
    this.ensureLogDir();
    const timestamp = new Date().toISOString();
    const errorEntry = `[${timestamp}] ERROR in ${command}: ${error.message}\n${error.stack}\n\n`;
    
    try {
      fs.appendFileSync(this.errorFile, errorEntry);
    } catch (writeError) {
      console.error('Failed to write to error log:', writeError);
    }
  }
};

// Formatter utility
const formatter = {
  formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
  },

  formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (mins > 0) result += `${mins}m `;
    if (secs > 0) result += `${secs}s`;

    return result || '0s';
  },

  showError(message, error) {
    console.log(chalk.red(`❌ ${message}`));
    if (error.response) {
      console.log(chalk.gray(`   Status: ${error.response.status}`));
      console.log(chalk.gray(`   Message: ${error.response.data?.message || error.message}`));
    } else {
      console.log(chalk.gray(`   Error: ${error.message}`));
    }
  }
};

// API utility
const api = {
  baseURL: 'https://api.gradient.network/api',
  timeout: process.env.API_TIMEOUT || 15000,

  getHeaders() {
    const token = process.env.GRADIENT_TOKEN;
    if (!token) {
      throw new Error('GRADIENT_TOKEN tidak ditemukan di environment variables');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
  },

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: this.getHeaders(),
        timeout: this.timeout
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Token tidak valid atau sudah expired');
      } else if (error.response?.status === 403) {
        throw new Error('Akses ditolak - periksa token atau permissions');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded - tunggu beberapa saat');
      } else if (error.response?.status >= 500) {
        throw new Error('Server error - coba lagi nanti');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - koneksi lambat');
      }
      throw error;
    }
  },

  async getUserProfile() {
    return this.makeRequest('/user/profile');
  },

  async getSentryNodes(nodeId = null) {
    const endpoint = nodeId ? `/sentrynode?nodeId=${nodeId}` : '/sentrynode';
    return this.makeRequest(endpoint);
  },

  async getNodeDetail(nodeId) {
    return this.makeRequest(`/sentrynode/get/${nodeId}`);
  },

  async getLatencyData(nodeId) {
    return this.makeRequest(`/sentrynode/latency?limit=100&nodeId=${nodeId}`);
  },

  async getMarketBanners() {
    return this.makeRequest('/market/banners');
  },

  async getMarketAnnouncements() {
    return this.makeRequest('/market/announcements');
  },

  async getStatus() {
    return this.makeRequest('/status');
  }
};

// Auto-ping service
const autoPingService = {
  isRunning: false,
  interval: null,
  pingCount: 0,
  errorCount: 0,
  maxErrors: 5,
  startTime: null,
  lastPingTime: null,
  userNodeId: null,

  start() {
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️  Auto-ping sudah berjalan!'));
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();
    this.pingCount = 0;
    this.errorCount = 0;

    console.log(chalk.green('🚀 Memulai auto-ping system...'));
    console.log(chalk.gray('⏰ Interval: 30 detik'));
    console.log(chalk.gray('📡 Endpoints: 2 target'));
    console.log(chalk.gray('🔄 System akan ping otomatis untuk menjaga koneksi aktif 24/7\n'));

    this.interval = setInterval(() => {
      this.performPing();
    }, 30000); // 30 seconds

    // Immediate first ping
    this.performPing();
  },

  stop() {
    if (!this.isRunning) {
      console.log(chalk.yellow('⚠️  Auto-ping tidak sedang berjalan'));
      return;
    }

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log(chalk.red('🛑 Auto-ping system dihentikan'));
  },

  async performPing() {
    if (!this.isRunning) return;

    try {
      // Hanya ping status endpoint untuk mengurangi beban
      await Promise.race([
        api.getStatus(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout')), 10000)
        )
      ]);

      this.pingCount++;
      this.lastPingTime = new Date();
      this.errorCount = 0; // Reset error count on success

      process.stdout.write(chalk.green('•'));

      // Show detailed status every 20 pings
      if (this.pingCount % 20 === 0) {
        console.log(chalk.blue(`\n📊 Ping #${this.pingCount} berhasil - Uptime: ${this.getUptime()}`));
        console.log(chalk.gray(`🕒 Last ping: ${this.lastPingTime.toLocaleTimeString('id-ID')}`));
        console.log(chalk.gray(`❌ Errors: ${this.errorCount}/${this.maxErrors}\n`));
      }

    } catch (error) {
      this.errorCount++;
      process.stdout.write(chalk.red('×'));

      // Log error details untuk debugging
      if (process.env.DEBUG === 'true') {
        console.log(chalk.gray(`\nDebug - Error: ${error.message}`));
      }

      if (this.errorCount >= this.maxErrors) {
        console.log(chalk.red(`\n❌ Terlalu banyak error (${this.errorCount}/${this.maxErrors})`));
        console.log(chalk.red('🛑 Menghentikan auto-ping untuk mencegah spam'));
        console.log(chalk.yellow('💡 Kemungkinan penyebab:'));
        console.log(chalk.gray('   • Token expired - perlu token baru'));
        console.log(chalk.gray('   • Koneksi internet bermasalah'));
        console.log(chalk.gray('   • Server Gradient sedang maintenance'));
        this.stop();
        return;
      }

      if (this.errorCount % 2 === 0) {
        console.log(chalk.yellow(`\n⚠️  Error count: ${this.errorCount}/${this.maxErrors}`));
      }
    }
  },

  getUptime() {
    if (!this.startTime) return '0s';
    const now = new Date();
    const diffMs = now - this.startTime;
    const diffSeconds = Math.floor(diffMs / 1000);
    return formatter.formatDuration(diffSeconds);
  },

  getNextPingTime() {
    if (!this.lastPingTime) return 'Segera';
    const nextPing = new Date(this.lastPingTime.getTime() + 30000);
    return nextPing.toLocaleTimeString('id-ID');
  },

  getStatus() {
    return {
      running: this.isRunning,
      pingCount: this.pingCount,
      errorCount: this.errorCount,
      maxErrors: this.maxErrors,
      uptime: this.getUptime(),
      lastPing: this.lastPingTime ? this.lastPingTime.toLocaleTimeString('id-ID') : null,
      nextPing: this.getNextPingTime()
    };
  }
};

// ===== COMMAND FUNCTIONS =====

async function profilCommand() {
  try {
    console.log(chalk.blue('👤 Mengambil data profil...\n'));
    
    const profile = await api.getUserProfile();
    
    if (profile.code !== 200) {
      throw new Error('Gagal mengambil data profil');
    }
    
    const data = profile.data;
    
    // Header info
    console.log(chalk.cyan.bold('='.repeat(60)));
    console.log(chalk.cyan.bold(`🎯 PROFIL AKUN GRADIENT NETWORK`));
    console.log(chalk.cyan.bold('='.repeat(60)));
    
    // Basic info table
    const basicTable = new Table({
      head: [chalk.cyan('Informasi'), chalk.cyan('Value')],
      colWidths: [25, 35]
    });
    
    basicTable.push(
      ['👤 Nama', chalk.white(data.name)],
      ['📧 Email', chalk.white(data.email)],
      ['🏷️  Kode Referral', chalk.yellow(data.code)],
      ['👥 Diundang Oleh', chalk.gray(data.referredBy || 'Tidak ada')],
      ['⭐ Level', chalk.green(`Level ${data.stats.level}`)],
      ['🏆 EXP', formatter.formatNumber(data.stats.exp)],
      ['👥 Total Undangan', chalk.blue(data.stats.invitee.toString())],
      ['⏳ Pending', chalk.yellow(data.stats.pending.toString())]
    );
    
    console.log(basicTable.toString());
    console.log();
    
    // Points table
    const pointsTable = new Table({
      head: [chalk.yellow('💰 POIN'), chalk.yellow('Jumlah')],
      colWidths: [25, 35]
    });
    
    pointsTable.push(
      ['💎 Total Poin', chalk.green(formatter.formatNumber(data.point.total))],
      ['💰 Saldo', chalk.green(formatter.formatNumber(data.point.balance))],
      ['📤 Ditarik', chalk.red(formatter.formatNumber(data.point.withdraw))],
      ['👥 Dari Referral', chalk.blue(formatter.formatNumber(data.point.referral))],
      ['📈 Hari Ini', chalk.yellow(formatter.formatNumber(data.point.today))]
    );
    
    console.log(pointsTable.toString());
    console.log();
    
    // Season points
    if (data.season) {
      const seasonTable = new Table({
        head: [chalk.blue('🏆 SEASON'), chalk.blue('Poin')],
        colWidths: [25, 35]
      });
      
      Object.keys(data.season).forEach(season => {
        if (season.includes('_refer')) {
          seasonTable.push([
            `Season ${season.replace('_refer', '')} (Referral)`,
            chalk.blue(formatter.formatNumber(data.season[season]))
          ]);
        } else if (!season.includes('_refer')) {
          seasonTable.push([
            `Season ${season}`,
            chalk.green(formatter.formatNumber(data.season[season]))
          ]);
        }
      });
      
      console.log(seasonTable.toString());
      console.log();
    }
    
    // Node information
    const nodeTable = new Table({
      head: [chalk.green('🖥️  NODE INFO'), chalk.green('Value')],
      colWidths: [25, 35]
    });
    
    nodeTable.push(
      ['🛡️  Total Sentry', chalk.blue(data.node.sentry.toString())],
      ['✅ Sentry Aktif', chalk.green(data.node.sentryActive.toString())],
      ['⏱️  Durasi Sentry', formatter.formatDuration(data.node.sentryDuration)],
      ['💼 Total Work', chalk.blue(data.node.work.toString())],
      ['✅ Work Aktif', chalk.green(data.node.workActive.toString())],
      ['⏱️  Total Durasi', formatter.formatDuration(data.node.totalDuration)]
    );
    
    console.log(nodeTable.toString());
    console.log();
    
    // Social media
    if (data.social && (data.social.twitter || data.social.discord)) {
      const socialTable = new Table({
        head: [chalk.cyan('📱 SOSIAL MEDIA'), chalk.cyan('Username')],
        colWidths: [25, 35]
      });
      
      if (data.social.twitter) {
        socialTable.push(['🐦 Twitter', chalk.blue(`@${data.social.twitter}`)]);
      }
      if (data.social.discord) {
        socialTable.push(['💬 Discord', chalk.blue(data.social.discord)]);
      }
      
      console.log(socialTable.toString());
      console.log();
    }
    
    // Status indicators
    const statusTable = new Table({
      head: [chalk.cyan('📊 STATUS'), chalk.cyan('Value')],
      colWidths: [25, 35]
    });
    
    statusTable.push(
      ['✅ Check-in Hari Ini', data.checkIn ? chalk.green('Sudah') : chalk.red('Belum')],
      ['👥 Following', chalk.blue(data.follow.toString())],
      ['📅 Bergabung', new Date(data.createAt).toLocaleDateString('id-ID')],
      ['🔄 Update Terakhir', new Date(data.updateAt).toLocaleDateString('id-ID')]
    );
    
    console.log(statusTable.toString());
    
    // Summary
    console.log(chalk.green('\n✨ Data profil berhasil ditampilkan!'));
    console.log(chalk.gray(`Season aktif: ${data.seasonNo}`));
    
    logger.logActivity('Profil dilihat');
    
  } catch (error) {
    formatter.showError('Gagal mengambil data profil', error);
    logger.logError('profil', error);
  }
}

async function nodeCommand() {
  try {
    console.log(chalk.blue('🖥️  Mengambil data sentry node...\n'));
    
    const nodes = await api.getSentryNodes();
    
    if (nodes.code !== 200) {
      throw new Error('Gagal mengambil data node');
    }
    
    console.log(chalk.cyan.bold('='.repeat(70)));
    console.log(chalk.cyan.bold('🖥️  SENTRY NODE MONITORING'));
    console.log(chalk.cyan.bold('='.repeat(70)));
    
    if (!nodes.data || nodes.data.length === 0) {
      console.log(chalk.yellow('⚠️  Tidak ada sentry node yang ditemukan'));
      return;
    }
    
    const table = new Table({
      head: [
        chalk.cyan('Node ID'),
        chalk.cyan('Status'),
        chalk.cyan('Uptime'),
        chalk.cyan('Points'),
        chalk.cyan('Last Seen')
      ],
      colWidths: [20, 12, 15, 15, 20]
    });
    
    nodes.data.forEach(node => {
      const status = node.status === 'online' ? chalk.green('🟢 Online') : 
                    node.status === 'offline' ? chalk.red('🔴 Offline') : 
                    chalk.yellow('🟡 Unknown');
      
      table.push([
        chalk.white(node.nodeId || 'N/A'),
        status,
        formatter.formatDuration(node.uptime || 0),
        chalk.green(formatter.formatNumber(node.points || 0)),
        node.lastSeen ? new Date(node.lastSeen).toLocaleString('id-ID') : 'N/A'
      ]);
    });
    
    console.log(table.toString());
    
    // Summary
    const onlineNodes = nodes.data.filter(n => n.status === 'online').length;
    const totalNodes = nodes.data.length;
    
    console.log(chalk.cyan('\n📊 RINGKASAN'));
    console.log(chalk.cyan('='.repeat(30)));
    console.log(chalk.green(`✅ Node Online: ${onlineNodes}`));
    console.log(chalk.gray(`📊 Total Node: ${totalNodes}`));
    console.log(chalk.blue(`🔄 Status: ${((onlineNodes/totalNodes)*100).toFixed(1)}% uptime`));
    
    console.log(chalk.green('\n✨ Data node berhasil ditampilkan!'));
    
    logger.logActivity('Node data dilihat');
    
  } catch (error) {
    formatter.showError('Gagal mengambil data node', error);
    logger.logError('node', error);
  }
}

async function nodeDetailCommand(nodeId) {
  try {
    console.log(chalk.blue(`🔍 Mengambil detail node: ${nodeId}...\n`));
    
    const nodeDetail = await api.getNodeDetail(nodeId);
    
    if (nodeDetail.code !== 200) {
      throw new Error('Gagal mengambil detail node');
    }
    
    const data = nodeDetail.data;
    
    console.log(chalk.cyan.bold('='.repeat(70)));
    console.log(chalk.cyan.bold(`🖥️  DETAIL NODE - ${data.id}`));
    console.log(chalk.cyan.bold('='.repeat(70)));
    
    // Basic Info Table
    const basicTable = new Table({
      head: [chalk.cyan('Informasi'), chalk.cyan('Value')],
      colWidths: [25, 45]
    });
    
    const status = data.active ? 
      (data.connect ? chalk.green('🟢 Online & Connected') : chalk.yellow('🟡 Active but Disconnected')) :
      chalk.red('🔴 Inactive');
    
    basicTable.push(
      ['🆔 Node ID', chalk.white(data.id)],
      ['👤 Account ID', chalk.gray(data.account)],
      ['🏷️  Nama Node', chalk.white(data.name)],
      ['⚡ Status', status],
      ['🚫 Banned', data.banned ? chalk.red('Ya') : chalk.green('Tidak')],
      ['📅 Dibuat', new Date(data.createAt).toLocaleString('id-ID')]
    );
    
    console.log(basicTable.toString());
    console.log();
    
    // Performance Stats
    const performanceTable = new Table({
      head: [chalk.yellow('📊 PERFORMA'), chalk.yellow('Value')],
      colWidths: [25, 45]
    });
    
    performanceTable.push(
      ['⏱️  Total Duration', formatter.formatDuration(Math.floor(data.duration / 1000))],
      ['📡 Latency', `${data.latency}ms`],
      ['💎 Total Points', chalk.green(formatter.formatNumber(data.point))],
      ['🏆 Season 1 Points', chalk.blue(formatter.formatNumber(data.season['1'] || 0))],
      ['📈 Score', data.score.toString()]
    );
    
    console.log(performanceTable.toString());
    console.log();
    
    // Today's Stats
    const todayTable = new Table({
      head: [chalk.green('📅 HARI INI'), chalk.green('Value')],
      colWidths: [25, 45]
    });
    
    todayTable.push(
      ['💰 Points Hari Ini', chalk.green(formatter.formatNumber(data.today))],
      ['⏱️  Duration Hari Ini', formatter.formatDuration(Math.floor(data.todayDuration / 1000))],
      ['📡 Latency Hari Ini', `${data.todayLatency}ms`],
      ['🔄 Last Active', data.lastActive === 0 ? chalk.green('Aktif sekarang') : new Date(data.lastActive).toLocaleString('id-ID')]
    );
    
    console.log(todayTable.toString());
    console.log();
    
    // Location Info
    if (data.location) {
      const locationTable = new Table({
        head: [chalk.blue('🌍 LOKASI'), chalk.blue('Value')],
        colWidths: [25, 45]
      });
      
      locationTable.push(
        ['🌐 IP Address', chalk.white(data.ip)],
        ['🏳️  Negara', chalk.white(data.location.country)],
        ['📍 Region', chalk.white(data.location.region)],
        ['🏙️  Kota', chalk.white(data.location.place)],
        ['📮 Kode Pos', data.location.postcode === 'N/A' ? chalk.gray('Tidak tersedia') : chalk.white(data.location.postcode)],
        ['🗺️  Koordinat', `${data.location.lat}, ${data.location.lng}`]
      );
      
      console.log(locationTable.toString());
      console.log();
    }
    
    // Performance Analysis
    console.log(chalk.cyan('🔍 ANALISIS PERFORMA'));
    console.log(chalk.cyan('='.repeat(40)));
    
    const dailyEfficiency = data.todayDuration > 0 ? (data.today / (data.todayDuration / 1000)) : 0;
    const totalEfficiency = data.duration > 0 ? (data.point / (data.duration / 1000)) : 0;
    
    console.log(chalk.white('📈 Efisiensi Points:'));
    console.log(chalk.gray(`   • Hari ini: ${dailyEfficiency.toFixed(2)} points/detik`));
    console.log(chalk.gray(`   • Total: ${totalEfficiency.toFixed(2)} points/detik`));
    
    console.log(chalk.white('\n📡 Performa Latency:'));
    if (data.latency < 100) {
      console.log(chalk.green('   • Excellent - Latency sangat baik (<100ms)'));
    } else if (data.latency < 300) {
      console.log(chalk.yellow('   • Good - Latency cukup baik (100-300ms)'));
    } else {
      console.log(chalk.red('   • Poor - Latency perlu diperbaiki (>300ms)'));
    }
    
    const uptimePercentage = data.duration > 0 ? ((data.duration / (Date.now() - data.createAt)) * 100) : 0;
    console.log(chalk.white('\n⏱️  Statistik Uptime:'));
    console.log(chalk.gray(`   • Estimasi uptime: ${uptimePercentage.toFixed(1)}%`));
    console.log(chalk.gray(`   • Durasi aktif: ${formatter.formatDuration(Math.floor(data.duration / 1000))}`));
    console.log(chalk.gray(`   • Umur node: ${formatter.formatDuration(Math.floor((Date.now() - data.createAt) / 1000))}`));
    
    // Status Indicators
    console.log(chalk.cyan('\n🚨 STATUS CHECKS'));
    console.log(chalk.cyan('='.repeat(30)));
    console.log(data.active ? chalk.green('✅ Node aktif') : chalk.red('❌ Node tidak aktif'));
    console.log(data.connect ? chalk.green('✅ Terkoneksi') : chalk.red('❌ Tidak terkoneksi'));
    console.log(data.banned ? chalk.red('⚠️  Node di-banned') : chalk.green('✅ Node dalam kondisi baik'));
    console.log(data.hide === 0 ? chalk.green('✅ Node visible') : chalk.yellow('⚠️  Node hidden'));
    
    console.log(chalk.green('\n✨ Detail node berhasil ditampilkan!'));
    
    logger.logActivity(`Detail node ${nodeId} dilihat`);
    
  } catch (error) {
    formatter.showError('Gagal mengambil detail node', error);
    logger.logError('nodeDetail', error);
  }
}

async function latencyCommand(nodeId) {
  try {
    console.log(chalk.blue(`📡 Menganalisis latency untuk node: ${nodeId}...\n`));
    
    const latencyData = await api.getLatencyData(nodeId);
    
    if (latencyData.code !== 200) {
      throw new Error('Gagal mengambil data latency');
    }
    
    console.log(chalk.cyan.bold('='.repeat(70)));
    console.log(chalk.cyan.bold(`📡 ANALISIS LATENCY - ${nodeId}`));
    console.log(chalk.cyan.bold('='.repeat(70)));
    
    if (!latencyData.data || latencyData.data.length === 0) {
      console.log(chalk.yellow('⚠️  Tidak ada data latency yang ditemukan'));
      return;
    }
    
    // Calculate statistics
    const latencies = latencyData.data.map(d => d.latency).filter(l => l != null);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    
    // Statistics table
    const statsTable = new Table({
      head: [chalk.yellow('📊 STATISTIK'), chalk.yellow('Value')],
      colWidths: [25, 20]
    });
    
    statsTable.push(
      ['📊 Total Sample', chalk.blue(latencies.length.toString())],
      ['⚡ Latency Rata-rata', chalk.green(`${avgLatency.toFixed(2)}ms`)],
      ['🚀 Latency Minimum', chalk.green(`${minLatency}ms`)],
      ['🐌 Latency Maximum', chalk.red(`${maxLatency}ms`)],
      ['📈 Range', chalk.gray(`${maxLatency - minLatency}ms`)]
    );
    
    console.log(statsTable.toString());
    console.log();
    
    // Recent latency data
    const recentTable = new Table({
      head: [
        chalk.cyan('Timestamp'),
        chalk.cyan('Latency'),
        chalk.cyan('Status'),
        chalk.cyan('Location')
      ],
      colWidths: [20, 12, 12, 25]
    });
    
    latencyData.data.slice(0, 10).forEach(record => {
      const latencyColor = record.latency < 100 ? chalk.green : 
                          record.latency < 300 ? chalk.yellow : chalk.red;
      
      recentTable.push([
        new Date(record.timestamp).toLocaleString('id-ID'),
        latencyColor(`${record.latency}ms`),
        record.status === 'success' ? chalk.green('✅') : chalk.red('❌'),
        chalk.gray(record.location || 'Unknown')
      ]);
    });
    
    console.log(chalk.blue('📋 10 RECORD TERAKHIR'));
    console.log(recentTable.toString());
    
    // Performance analysis
    console.log(chalk.cyan('\n🔍 ANALISIS PERFORMA'));
    console.log(chalk.cyan('='.repeat(40)));
    
    const excellentCount = latencies.filter(l => l < 50).length;
    const goodCount = latencies.filter(l => l >= 50 && l < 100).length;
    const fairCount = latencies.filter(l => l >= 100 && l < 300).length;
    const poorCount = latencies.filter(l => l >= 300).length;
    
    console.log(chalk.green(`🚀 Excellent (<50ms): ${excellentCount} (${((excellentCount/latencies.length)*100).toFixed(1)}%)`));
    console.log(chalk.blue(`✅ Good (50-100ms): ${goodCount} (${((goodCount/latencies.length)*100).toFixed(1)}%)`));
    console.log(chalk.yellow(`⚠️  Fair (100-300ms): ${fairCount} (${((fairCount/latencies.length)*100).toFixed(1)}%)`));
    console.log(chalk.red(`🐌 Poor (>300ms): ${poorCount} (${((poorCount/latencies.length)*100).toFixed(1)}%)`));
    
    console.log(chalk.green('\n✨ Analisis latency berhasil ditampilkan!'));
    
    logger.logActivity(`Latency dianalisis untuk node ${nodeId}`);
    
  } catch (error) {
    formatter.showError('Gagal menganalisis latency', error);
    logger.logError('latency', error);
  }
}

async function pengumumanCommand() {
  try {
    console.log(chalk.blue('📢 Mengambil pengumuman dan banner terbaru...\n'));
    
    // Ambil data banner dan pengumuman secara bersamaan
    const [bannerData, announcementData] = await Promise.all([
      api.getMarketBanners(),
      api.getMarketAnnouncements()
    ]);
    
    // Header
    console.log(chalk.cyan.bold('='.repeat(70)));
    console.log(chalk.cyan.bold('📢 PENGUMUMAN & BANNER GRADIENT NETWORK'));
    console.log(chalk.cyan.bold('='.repeat(70)));
    
    // Tampilkan banner jika ada
    if (bannerData.code === 200 && bannerData.data && bannerData.data.length > 0) {
      console.log(chalk.yellow.bold('\n🎨 BANNER PROMOSI'));
      console.log(chalk.yellow('='.repeat(50)));
      
      const bannerTable = new Table({
        head: [chalk.yellow('Judul'), chalk.yellow('Deskripsi'), chalk.yellow('Link')],
        colWidths: [20, 30, 35],
        wordWrap: true
      });
      
      bannerData.data.forEach(banner => {
        bannerTable.push([
          chalk.white(banner.title || 'Tidak ada judul'),
          chalk.gray(banner.content || banner.detail || 'Tidak ada deskripsi'),
          chalk.blue(banner.link || 'Tidak ada link')
        ]);
      });
      
      console.log(bannerTable.toString());
      
      // Tampilkan detail banner dengan gambar jika ada
      bannerData.data.forEach((banner, index) => {
        if (banner.image) {
          console.log(chalk.cyan(`\n🖼️  Banner ${index + 1} - ${banner.title}:`));
          if (banner.image.dashboard) {
            console.log(chalk.gray(`   Dashboard: ${banner.image.dashboard}`));
          }
          if (banner.image.extension) {
            console.log(chalk.gray(`   Extension: ${banner.image.extension}`));
          }
        }
      });
    } else {
      console.log(chalk.yellow('\n🎨 Tidak ada banner promosi saat ini'));
    }
    
    // Tampilkan pengumuman jika ada
    if (announcementData.code === 200 && announcementData.data && announcementData.data.length > 0) {
      console.log(chalk.green.bold('\n📢 PENGUMUMAN TERBARU'));
      console.log(chalk.green('='.repeat(50)));
      
      announcementData.data.forEach((announcement, index) => {
        console.log(chalk.cyan(`\n📋 Pengumuman ${index + 1}:`));
        console.log(chalk.white.bold(`   ${announcement.title || 'Pengumuman'}`));
        
        if (announcement.content) {
          // Format content untuk menampilkan markdown dengan lebih baik
          const content = announcement.content
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, chalk.blue('$1') + chalk.gray(' ($2)'))
            .replace(/\*\*([^*]+)\*\*/g, chalk.bold('$1'))
            .replace(/\*([^*]+)\*/g, chalk.italic('$1'));
          
          console.log(chalk.gray(`   ${content}`));
        }
        
        if (announcement.id && announcement.id !== 'version' && announcement.id !== 'background') {
          console.log(chalk.gray(`   ID: ${announcement.id}`));
        }
        
        // Handle khusus untuk pengumuman version
        if (announcement.id === 'version') {
          console.log(chalk.yellow(`   🔄 Versi Minimum: ${announcement.minVersion}`));
          console.log(chalk.green(`   📦 Versi Terbaru: ${announcement.newVersion}`));
        }
        
        // Handle khusus untuk background/image
        if (announcement.image) {
          console.log(chalk.blue('   🖼️  Gambar:'));
          Object.keys(announcement.image).forEach(imageType => {
            console.log(chalk.gray(`     ${imageType}: ${announcement.image[imageType]}`));
          });
        }
      });
    } else {
      console.log(chalk.yellow('\n📢 Tidak ada pengumuman terbaru'));
    }
    
    // Tampilkan ringkasan
    console.log(chalk.cyan.bold('\n📊 RINGKASAN'));
    console.log(chalk.cyan('='.repeat(30)));
    
    const summaryTable = new Table({
      head: [chalk.cyan('Jenis'), chalk.cyan('Jumlah')],
      colWidths: [20, 15]
    });
    
    const bannerCount = (bannerData.code === 200 && bannerData.data) ? bannerData.data.length : 0;
    const announcementCount = (announcementData.code === 200 && announcementData.data) ? announcementData.data.length : 0;
    
    summaryTable.push(
      ['🎨 Banner', chalk.yellow(bannerCount.toString())],
      ['📢 Pengumuman', chalk.green(announcementCount.toString())],
      ['📅 Diperbarui', chalk.gray(new Date().toLocaleString('id-ID'))]
    );
    
    console.log(summaryTable.toString());
    
    // Cek update version jika ada
    const versionAnnouncement = announcementData.data?.find(item => item.id === 'version');
    if (versionAnnouncement) {
      console.log(chalk.yellow('\n⚠️  PEMBERITAHUAN VERSION:'));
      console.log(chalk.yellow('='.repeat(40)));
      console.log(chalk.red(`❗ ${versionAnnouncement.content}`));
      console.log(chalk.blue(`📦 Versi minimum: ${versionAnnouncement.minVersion}`));
      console.log(chalk.green(`🆕 Versi terbaru: ${versionAnnouncement.newVersion}`));
    }
    
    // Tips
    console.log(chalk.blue('\n💡 Tips:'));
    console.log(chalk.gray('   • Periksa pengumuman secara berkala untuk update terbaru'));
    console.log(chalk.gray('   • Banner promosi biasanya mengarah ke fitur atau layanan baru'));
    console.log(chalk.gray('   • Pastikan selalu menggunakan versi extension terbaru'));
    
    console.log(chalk.green('\n✨ Data pengumuman berhasil ditampilkan!'));
    
    logger.logActivity('Pengumuman dilihat');
    
  } catch (error) {
    formatter.showError('Gagal mengambil data pengumuman', error);
    logger.logError('pengumuman', error);
  }
}

// ===== MAIN APPLICATION FUNCTIONS =====

// Header ASCII art
console.log(
  chalk.cyan(
    figlet.textSync('Gradient CLI', {
      font: 'Small',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    })
  )
);

console.log(chalk.gray('🚀 CLI Tool untuk Monitoring Gradient Network\n'));

// Status check function
async function statusCommand() {
  try {
    console.log(chalk.blue('📊 Mengecek status sistem...\n'));
    
    const response = await api.getStatus();
    
    if (response && response.time) {
      console.log(chalk.green('✅ Sistem Online'));
      console.log(chalk.gray(`⏰ Waktu: ${new Date(response.time).toLocaleString('id-ID')}`));
      console.log(chalk.gray(`🌐 IP: ${response.ip}`));
      console.log(chalk.gray(`🏷️  Environment: ${response.env}`));
    } else {
      console.log(chalk.red('❌ Sistem bermasalah'));
    }
  } catch (error) {
    formatter.showError('Gagal mengecek status sistem', error);
  }
}

// Token validation function
async function validateTokenCommand() {
  try {
    console.log(chalk.blue('🔑 Validasi token...\n'));
    
    const token = process.env.GRADIENT_TOKEN;
    if (!token) {
      console.log(chalk.red('❌ Token tidak ditemukan di .env'));
      return;
    }
    
    console.log(chalk.gray(`🔍 Token (10 karakter pertama): ${token.substring(0, 10)}...`));
    
    // Test dengan endpoint profil
    const profile = await api.getUserProfile();
    
    if (profile.code === 200) {
      console.log(chalk.green('✅ Token valid dan aktif'));
      console.log(chalk.gray(`👤 User: ${profile.data.name}`));
      console.log(chalk.gray(`📧 Email: ${profile.data.email}`));
    } else {
      console.log(chalk.red('❌ Token tidak valid'));
    }
    
  } catch (error) {
    if (error.message.includes('expired')) {
      console.log(chalk.red('❌ Token sudah expired'));
      console.log(chalk.yellow('💡 Cara mendapatkan token baru:'));
      console.log(chalk.gray('   1. Buka browser dengan extension Gradient'));
      console.log(chalk.gray('   2. Buka DevTools (F12) > Network tab'));
      console.log(chalk.gray('   3. Refresh extension, cari request ke api.gradient.network'));
      console.log(chalk.gray('   4. Copy Authorization header (setelah "Bearer ")'));
      console.log(chalk.gray('   5. Update GRADIENT_TOKEN di file .env'));
    } else {
      formatter.showError('Gagal validasi token', error);
    }
  }
}

// Main menu function
async function showMainMenu() {
  const autoPingStatus = autoPingService.getStatus();
  const autoPingText = autoPingStatus.running 
    ? `🔄 Auto-Ping 24/7 (Aktif - ${autoPingStatus.uptime})`
    : '🔄 Auto-Ping 24/7 (Nonaktif)';

  const choices = [
    {
      name: '👤 Lihat Profil & Statistik Akun',
      value: 'profil'
    },
    {
      name: '🖥️  Monitor Sentry Node',
      value: 'node'
    },
    {
      name: '🔍 Detail Node Spesifik',
      value: 'nodedetail'
    },
    {
      name: '📡 Analisis Latency Node',
      value: 'latency'
    },
    {
      name: '📢 Pengumuman & Banner Terbaru',
      value: 'pengumuman'
    },
    {
      name: '📊 Status Sistem Gradient Network',
      value: 'status'
    },
    {
      name: '🔑 Validasi Token',
      value: 'token'
    },
    {
      name: autoPingText,
      value: 'autoping'
    },
    {
      name: '❌ Keluar',
      value: 'exit'
    }
  ];

  const { selectedMenu } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedMenu',
      message: chalk.cyan('Pilih menu yang ingin diakses:'),
      choices: choices,
      pageSize: 10
    }
  ]);

  return selectedMenu;
}

// Auto-ping menu function
async function autoPingMenu() {
  const status = autoPingService.getStatus();
  
  console.log(chalk.cyan('\n🔄 SISTEM AUTO-PING 24/7'));
  console.log(chalk.gray('━'.repeat(50)));
  
  if (status.running) {
    console.log(chalk.green('✅ Status: Aktif'));
    console.log(chalk.gray(`📊 Total Ping: ${status.pingCount}`));
    console.log(chalk.gray(`⏰ Uptime: ${status.uptime}`));
    console.log(chalk.gray(`❌ Error: ${status.errorCount}/${status.maxErrors}`));
    console.log(chalk.gray(`🕒 Ping Terakhir: ${status.lastPing || 'Belum ada'}`));
    console.log(chalk.gray(`⏭️  Ping Berikutnya: ${status.nextPing}`));
  } else {
    console.log(chalk.red('❌ Status: Nonaktif'));
    console.log(chalk.yellow('💡 Auto-ping akan menjaga koneksi tetap aktif 24/7'));
    console.log(chalk.gray('   Sistem akan ping server setiap 30 detik'));
  }
  
  console.log(chalk.gray('━'.repeat(50)));
  
  const choices = [];
  
  if (status.running) {
    choices.push(
      { name: '📊 Lihat Status Detail', value: 'status' },
      { name: '🖥️  Set Node ID untuk Monitor', value: 'setnode' },
      { name: '🛑 Hentikan Auto-Ping', value: 'stop' },
      { name: '🔙 Kembali ke Menu Utama', value: 'back' }
    );
  } else {
    choices.push(
      { name: '🚀 Mulai Auto-Ping 24/7', value: 'start' },
      { name: '📚 Info Auto-Ping', value: 'info' },
      { name: '🔙 Kembali ke Menu Utama', value: 'back' }
    );
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Pilih aksi:',
      choices: choices
    }
  ]);

  switch (action) {
    case 'start':
      console.log(chalk.blue('\n🚀 Memulai sistem auto-ping...'));
      autoPingService.start();
      
      console.log(chalk.green('\n✅ Auto-ping 24/7 berhasil dimulai!'));
      console.log(chalk.yellow('💡 Sistem akan terus berjalan di background'));
      console.log(chalk.gray('   Anda bisa keluar dari CLI, auto-ping tetap aktif'));
      console.log(chalk.gray('   Gunakan menu ini untuk monitoring atau menghentikan\n'));
      break;
      
    case 'stop':
      console.log(chalk.yellow('\n⚠️  Menghentikan auto-ping...'));
      autoPingService.stop();
      console.log(chalk.red('✅ Auto-ping berhasil dihentikan\n'));
      break;
      
    case 'status':
      const currentStatus = autoPingService.getStatus();
      console.log(chalk.blue('\n📊 STATUS DETAIL AUTO-PING'));
      console.log(chalk.gray('━'.repeat(40)));
      console.log(chalk.green(`🔄 Running: ${currentStatus.running ? 'Ya' : 'Tidak'}`));
      console.log(chalk.gray(`📈 Total Ping: ${currentStatus.pingCount}`));
      console.log(chalk.gray(`⏱️  Uptime: ${currentStatus.uptime}`));
      console.log(chalk.gray(`🔴 Error Count: ${currentStatus.errorCount}/${currentStatus.maxErrors}`));
      console.log(chalk.gray(`🕒 Last Success: ${currentStatus.lastPing || 'Belum ada'}`));
      console.log(chalk.gray(`⏭️  Next Ping: ${currentStatus.nextPing}`));
      console.log(chalk.gray(`🖥️  Node ID: ${autoPingService.userNodeId || 'Tidak diset'}`));
      console.log(chalk.gray('━'.repeat(40) + '\n'));
      break;

    case 'setnode':
      const { newNodeId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newNodeId',
          message: 'Masukkan Node ID untuk monitoring:',
          default: autoPingService.userNodeId || 'W2F5PWFHP7YUYY7V',
          validate: (input) => {
            if (!input.trim()) {
              return 'Node ID tidak boleh kosong!';
            }
            if (input.length < 10) {
              return 'Node ID terlalu pendek!';
            }
            return true;
          }
        }
      ]);
      
      autoPingService.userNodeId = newNodeId.trim();
      console.log(chalk.green(`\n✅ Node ID berhasil diset: ${newNodeId}`));
      console.log(chalk.yellow('💡 Auto-ping akan monitor node ini setiap 5 ping\n'));
      break;
      
    case 'info':
      console.log(chalk.blue('\n📚 INFORMASI AUTO-PING SYSTEM'));
      console.log(chalk.gray('━'.repeat(50)));
      console.log(chalk.white('🎯 Tujuan:'));
      console.log(chalk.gray('   • Menjaga koneksi tetap aktif 24/7'));
      console.log(chalk.gray('   • Mencegah timeout dari server'));
      console.log(chalk.gray('   • Monitoring otomatis sistem'));
      console.log(chalk.white('\n⚙️  Cara Kerja:'));
      console.log(chalk.gray('   • Ping server setiap 30 detik'));
      console.log(chalk.gray('   • Monitor status sistem otomatis'));
      console.log(chalk.gray('   • Auto-stop jika terlalu banyak error'));
      console.log(chalk.white('\n🔒 Keamanan:'));
      console.log(chalk.gray('   • Hanya ping endpoint publik'));
      console.log(chalk.gray('   • Tidak mengirim data sensitif'));
      console.log(chalk.gray('   • Rate limiting protection'));
      console.log(chalk.gray('━'.repeat(50) + '\n'));
      break;
      
    case 'back':
      return; // Kembali ke menu utama
  }
  
  // Jika bukan back, tanyakan apakah ingin tetap di menu auto-ping
  if (action !== 'back') {
    const { stayInMenu } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'stayInMenu',
        message: 'Tetap di menu auto-ping?',
        default: false
      }
    ]);
    
    if (stayInMenu) {
      await autoPingMenu(); // Recursive call
    }
  }
}

// Execute selected command
async function executeCommand(command) {
  console.log(); // Add spacing
  
  switch (command) {
    case 'profil':
      await profilCommand();
      break;
      
    case 'node':
      await nodeCommand();
      break;
      
    case 'nodedetail':
      // Minta input nodeId untuk detail
      const { detailNodeId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'detailNodeId',
          message: 'Masukkan Node ID untuk melihat detail:',
          default: 'W2F5PWFHP7YUYY7V',
          validate: (input) => {
            if (!input.trim()) {
              return 'Node ID tidak boleh kosong!';
            }
            if (input.length < 10) {
              return 'Node ID terlalu pendek!';
            }
            return true;
          }
        }
      ]);
      await nodeDetailCommand(detailNodeId);
      break;
      
    case 'latency':
      // Minta input nodeId untuk latency
      const { nodeId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'nodeId',
          message: 'Masukkan Node ID untuk analisis latency:',
          validate: (input) => {
            if (!input.trim()) {
              return 'Node ID tidak boleh kosong!';
            }
            return true;
          }
        }
      ]);
      await latencyCommand(nodeId);
      break;
      
    case 'pengumuman':
      await pengumumanCommand();
      break;
      
    case 'status':
      await statusCommand();
      break;
      
    case 'token':
      await validateTokenCommand();
      break;
      
    case 'autoping':
      await autoPingMenu();
      break;
      
    case 'exit':
      console.log(chalk.green('\n👋 Terima kasih telah menggunakan Gradient CLI!'));
      console.log(chalk.gray('🚀 Sampai jumpa lagi!\n'));
      process.exit(0);
      break;
      
    default:
      console.log(chalk.red('❌ Menu tidak valid!'));
  }
}

// Main application loop
async function main() {
  try {
    while (true) {
      const selectedCommand = await showMainMenu();
      await executeCommand(selectedCommand);
      
      // Jika bukan exit, tanyakan apakah ingin kembali ke menu
      if (selectedCommand !== 'exit') {
        console.log(); // Add spacing
        
        const { continueMenu } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueMenu',
            message: chalk.yellow('Kembali ke menu utama?'),
            default: true
          }
        ]);
        
        if (!continueMenu) {
          console.log(chalk.green('\n👋 Terima kasih telah menggunakan Gradient CLI!'));
          console.log(chalk.gray('🚀 Sampai jumpa lagi!\n'));
          break;
        }
        
        console.clear(); // Clear screen for fresh menu
        
        // Show header again
        console.log(
          chalk.cyan(
            figlet.textSync('Gradient CLI', {
              font: 'Small',
              horizontalLayout: 'default',
              verticalLayout: 'default'
            })
          )
        );
        console.log(chalk.gray('🚀 CLI Tool untuk Monitoring Gradient Network\n'));
      }
    }
  } catch (error) {
    if (error.isTtyError) {
      console.log(chalk.red('❌ Terminal tidak mendukung interactive prompt'));
      console.log(chalk.yellow('💡 Coba jalankan di terminal yang mendukung interaksi'));
    } else {
      console.log(chalk.red('❌ Terjadi kesalahan:', error.message));
    }
    process.exit(1);
  }
}

// Start the application
main();
