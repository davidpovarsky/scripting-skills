#!/bin/sh
# 测试 SSH 连接

if [ -z "$1" ]; then
    echo "用法: sh test-connection.sh user@host [key_name]"
    echo ""
    echo "参数:"
    echo "  user@host  - SSH 目标（必需）"
    echo "  key_name   - 密钥名称，默认 id_server"
    echo ""
    echo "示例:"
    echo "  sh test-connection.sh root@192.168.1.1"
    echo "  sh test-connection.sh root@192.168.1.1 id_ed25519"
    exit 1
fi

TARGET="$1"
KEY_NAME="${2:-id_server}"
SSH_DIR="$HOME/Documents/.ssh"
KEY_PATH="$SSH_DIR/$KEY_NAME"

echo "=== SSH 连接测试 ==="
echo ""
echo "目标: $TARGET"
echo "密钥: $KEY_PATH"
echo ""

# 检查密钥
if [ ! -f "$KEY_PATH" ]; then
    echo "错误: 密钥不存在: $KEY_PATH"
    echo "请先运行: sh scripts/generate-key.sh $KEY_NAME"
    exit 1
fi

# 测试连接
echo "测试连接中..."
echo ""

OUTPUT=$(ssh -T -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i "$KEY_PATH" "$TARGET" "echo 'SSH_OK' && uname -a" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ] && echo "$OUTPUT" | grep -q "SSH_OK"; then
    echo "=== 连接成功 ==="
    echo ""
    echo "服务器信息:"
    echo "$OUTPUT" | grep -v "SSH_OK"
    echo ""
    echo "可以使用以下命令执行远程操作:"
    echo "ssh -T -o BatchMode=yes -i $KEY_PATH $TARGET \"命令\""
else
    echo "=== 连接失败 ==="
    echo ""
    echo "退出码: $EXIT_CODE"
    echo "输出: $OUTPUT"
    echo ""
    
    if echo "$OUTPUT" | grep -q "Permission denied"; then
        echo "原因: 公钥未在服务器配置"
        echo ""
        echo "解决方法: 在服务器上添加公钥"
        echo "公钥内容:"
        cat "$KEY_PATH.pub"
    elif echo "$OUTPUT" | grep -q "Connection refused"; then
        echo "原因: SSH 服务未运行或端口错误"
    elif echo "$OUTPUT" | grep -q "Connection timed out"; then
        echo "原因: 网络不通或防火墙阻止"
    elif echo "$OUTPUT" | grep -q "ios_popen failed"; then
        echo "原因: 缺少 -T 参数或尝试密码认证"
    fi
    
    exit 1
fi
