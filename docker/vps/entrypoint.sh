#!/bin/bash
set -e

if [ -n "$ROOT_PASSWORD" ]; then
    echo "root:$ROOT_PASSWORD" | chpasswd
fi

if [ -n "$SSH_PUBLIC_KEY" ]; then
    mkdir -p /root/.ssh
    echo "$SSH_PUBLIC_KEY" > /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
fi

if [ -n "$CLOUD_INIT_SCRIPT" ]; then
    echo "Running cloud-init script..."
    echo "$CLOUD_INIT_SCRIPT" > /tmp/cloud-init.sh
    chmod +x /tmp/cloud-init.sh
    /tmp/cloud-init.sh || true
fi

exec /usr/sbin/sshd -D
