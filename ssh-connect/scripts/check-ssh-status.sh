#!/bin/sh
# 检查 iOS 环境中的 SSH 配置状态

echo "=== SSH 环境检查 ==="
echo ""

# 1. SSH 版本
echo "1. SSH 版本:"
ssh -V 2>&1
echo ""

# 2. SSH 默认目录
echo "2. SSH 默认目录:"
echo "   $HOME/Documents/.ssh"
echo ""

# 3. .ssh 目录状态
SSH_DIR="$HOME/Documents/.ssh"
echo "3. .ssh 目录状态:"
if [ -d "$SSH_DIR" ]; then
    echo "   目录存在: $SSH_DIR"
    ls -la "$SSH_DIR" 2>/dev/null
else
    echo "   目录不存在，需要创建"
    echo "   运行: mkdir -p $SSH_DIR && chmod 700 $SSH_DIR"
fi
echo ""

# 4. 密钥文件检查
echo "4. 密钥文件:"
for key in id_server id_ed25519 id_rsa; do
    if [ -f "$SSH_DIR/$key" ]; then
        echo "   [存在] $key"
        if [ -f "$SSH_DIR/$key.pub" ]; then
            echo "   公钥内容:"
            cat "$SSH_DIR/$key.pub"
        fi
    fi
done

if [ ! -f "$SSH_DIR/id_server" ] && [ ! -f "$SSH_DIR/id_ed25519" ] && [ ! -f "$SSH_DIR/id_rsa" ]; then
    echo "   [无密钥] 需要生成密钥"
    echo "   运行: sh scripts/generate-key.sh"
fi
echo ""

# 5. known_hosts
echo "5. known_hosts:"
if [ -f "$SSH_DIR/known_hosts" ]; then
    echo "   已记录的主机:"
    cat "$SSH_DIR/known_hosts" | cut -d' ' -f1
else
    echo "   [空] 无已知主机"
fi
echo ""

echo "=== 检查完成 ==="
