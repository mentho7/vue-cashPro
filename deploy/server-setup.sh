#!/bin/bash
# CashPro 服务器一键初始化脚本
# 适用系统: Ubuntu 24.04 LTS
# 用法: ssh root@47.116.75.3 'bash -s' < server-setup.sh
# 或在服务器上直接: bash server-setup.sh

set -e

# ── 0. 前置检查 ──────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "请用 root 用户执行: sudo bash server-setup.sh"
  exit 1
fi

CASHPRO_ROOT="/var/www/cashpro"
DATA_DIR="$CASHPRO_ROOT/data"

echo "============================================"
echo "  CashPro 服务器初始化"
echo "  系统: Ubuntu 24.04 LTS"
echo "  域名: minthol.cn"
echo "============================================"
echo ""

# ── 1. 安装 Nginx ────────────────────────────────
echo "[1/7] 安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get update -qq
    apt-get install -y nginx
    echo "      Nginx 已安装: $(nginx -v 2>&1)"
else
    echo "      Nginx 已存在: $(nginx -v 2>&1)"
fi
echo ""

# ── 2. 创建目录结构 ──────────────────────────────
echo "[2/7] 创建目录结构..."
mkdir -p "$DATA_DIR/morning"
mkdir -p "$DATA_DIR/evening"
mkdir -p "$CASHPRO_ROOT/dist"
chmod -R 755 "$CASHPRO_ROOT"
echo "      $CASHPRO_ROOT/"
echo "      ├── dist/           (前端静态文件)"
echo "      └── data/"
echo "          ├── morning/    (早盘 JSON: YYYY-MM-DD-morning.json)"
echo "          └── evening/    (晚盘 JSON: YYYY-MM-DD-evening.json)"
echo ""

# ── 3. 写入健康检查文件 ──────────────────────────
echo "[3/7] 写入健康检查文件..."

# 健康检查文件 (不做占位假数据——等用户上传第一批正式数据后页面才有内容)
echo '{"status":"ok","service":"cashpro","time":"'$(date -Iseconds)'"}' > "$DATA_DIR/health.json"

echo "      健康检查文件已写入"
echo ""

# ── 4. 配置 Nginx 站点 ───────────────────────────
echo "[4/7] 配置 Nginx 站点..."

# 写入站点配置 (Ubuntu 约定: /etc/nginx/sites-available/)
cat > /etc/nginx/sites-available/cashpro << 'NGINXEOF'
# CashPro 站点配置
# 文件位置: /etc/nginx/sites-available/cashpro

server {
    listen 80;
    listen [::]:80;
    server_name minthol.cn;

    # 前端静态站点
    root /var/www/cashpro/dist;
    index index.html;

    # SPA 路由: 所有非文件请求回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 数据 API (只读，供前端 fetch)
    location /data/ {
        alias /var/www/cashpro/data/;

        # 跨域允许 (开发环境从其他端口访问时需要)
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;

        # 不缓存数据文件，确保每次请求都是最新的
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        expires -1;

        # JSON MIME 类型
        types {
            application/json json;
        }

        # 只允许 GET 请求
        limit_except GET {
            deny all;
        }

        # 禁止列出目录
        autoindex off;
    }

    # 静态资源缓存 (JS/CSS/图片)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # gzip 压缩
    gzip on;
    gzip_types text/css application/javascript application/json;
    gzip_min_length 1024;
}
NGINXEOF

# 启用站点: 创建符号链接到 sites-enabled/
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/cashpro /etc/nginx/sites-enabled/cashpro

echo "      配置已写入: /etc/nginx/sites-available/cashpro"
echo "      已启用:      /etc/nginx/sites-enabled/cashpro -> ../sites-available/cashpro"
echo "      已禁用:      /etc/nginx/sites-enabled/default"
echo ""

# ── 5. 启动 Nginx ────────────────────────────────
echo "[5/7] 启动 Nginx..."
nginx -t 2>&1
systemctl enable nginx
systemctl restart nginx
echo "      Nginx 已启动并设为开机自启"
echo ""

# ── 6. 配置防火墙 ────────────────────────────────
echo "[6/7] 配置防火墙..."
if command -v ufw &> /dev/null; then
    # ⚠️ 必须先放行 SSH，再启用 ufw，否则会把自己锁在外面
    ufw allow ssh 2>/dev/null || ufw allow 22/tcp
    ufw allow 'Nginx Full' 2>/dev/null || {
        ufw allow 80/tcp
        ufw allow 443/tcp
    }
    ufw --force enable 2>/dev/null || true
    echo "      ufw 已开放 22 (SSH) / 80 (HTTP) / 443 (HTTPS)"
else
    echo "      ufw 未安装 (跳过 - 请确保阿里云安全组已开放 80/443)"
fi
echo ""

# ── 7. 验证 ──────────────────────────────────────
echo "[7/7] 验证..."
echo ""

# 检查 Nginx 状态
NGINX_STATUS=$(systemctl is-active nginx)
if [ "$NGINX_STATUS" = "active" ]; then
    echo "      [OK] Nginx 运行中"
else
    echo "      [FAIL] Nginx 状态: $NGINX_STATUS"
    echo "      排查: journalctl -u nginx -n 20"
fi

# 检查数据文件
for d in morning evening; do
    if [ -d "$DATA_DIR/$d" ]; then
        echo "      [OK] $DATA_DIR/$d/"
    else
        echo "      [FAIL] $DATA_DIR/$d/ 缺失"
    fi
done
if [ -f "$DATA_DIR/health.json" ]; then
    echo "      [OK] health.json"
else
    echo "      [FAIL] health.json 缺失"
fi

# 检查本地访问
LOCAL_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/data/health.json 2>/dev/null || echo "000")
if [ "$LOCAL_CHECK" = "200" ]; then
    echo "      [OK] 本地数据访问正常 (HTTP $LOCAL_CHECK)"
else
    echo "      [WARN] 本地数据访问返回 HTTP $LOCAL_CHECK (前端未部署时正常)"
fi

echo ""
echo "============================================"
echo "  初始化完成!"
echo "============================================"
echo ""
echo "目录结构:"
find "$CASHPRO_ROOT" -maxdepth 2 | sort | sed "s|$CASHPRO_ROOT|/var/www/cashpro|"
echo ""
echo "─── 下一步操作 ───"
echo ""
echo "1. 上传前端:"
echo "   scp -r dist/* root@47.116.75.3:/var/www/cashpro/dist/"
echo ""
echo "2. 上传第一批正式数据:"
echo "   scp 2026-08-03-morning.json root@47.116.75.3:/var/www/cashpro/data/morning/"
echo "   scp 2026-08-03-evening.json root@47.116.75.3:/var/www/cashpro/data/evening/"
echo ""
echo "3. 配置 HTTPS (推荐):"
echo "   apt install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d minthol.cn"
echo ""
echo "4. 配置 SSH 免密 + WorkBuddy 定时任务 (见 DEPLOY.md)"
echo ""
echo "5. 验证:"
echo "   curl http://minthol.cn/data/health.json"
echo "   浏览器打开 http://minthol.cn"
echo ""
