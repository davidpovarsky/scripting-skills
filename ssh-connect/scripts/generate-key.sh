#!/bin/sh
# 生成 SSH 密钥对（Ed25519）

KEY_NAME="${1:-id_server}"
SSH_DIR="$HOME/Documents/.ssh"
KEY_PATH="$SSH_DIR/$KEY_NAME"

echo "=== SSH 密钥生成 ==="
echo ""

# 确保 .ssh 目录存在
if [ ! -d "$SSH_DIR" ]; then
    echo "创建 .ssh 目录..."
    mkdir -p "$SSH_DIR"
    chmod 700 "$SSH_DIR"
fi

# 检查密钥是否已存在
if [ -f "$KEY_PATH" ]; then
    echo "警告: 密钥已存在: $KEY_PATH"
    echo "如需重新生成，请先删除现有密钥"
    echo ""
    echo "现有公钥内容:"
    cat "$KEY_PATH.pub"
    exit 0
fi

# 生成密钥
echo "生成 Ed25519 密钥: $KEY_PATH"
ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "ios-scripting"

if [ $? -eq 0 ]; then
    chmod 600 "$KEY_PATH"
    chmod 644 "$KEY_PATH.pub"
    
    echo ""
    echo "=== 密钥生成成功 ==="
    echo ""
    echo "私钥: $KEY_PATH"
    echo "公钥: $KEY_PATH.pub"
    echo ""
    echo "公钥内容（需要添加到服务器）:"
    echo "----------------------------------------"
    cat "$KEY_PATH.pub"
    echo "----------------------------------------"
    echo ""
    echo "在服务器上执行以下命令添加公钥:"
    echo ""
    echo "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
    echo "echo '$(cat "$KEY_PATH.pub")' >> ~/.ssh/authorized_keys"
    echo "chmod 600 ~/.ssh/authorized_keys"
else
    echo "错误: 密钥生成失败"
    exit 1
fi
