#!/bin/sh
set -e

echo "Installing dependencies..."
apk add --no-cache openssh-client autossh openssh-keygen

echo "Checking for SSH key..."
if [ ! -f /root/.ssh/id_rsa ]; then
  echo "Generating SSH key for Serveo subdomain registration..."
  ssh-keygen -t rsa -b 4096 -f /root/.ssh/id_rsa -N '' -C 'hrflow-tunnel'
  echo "SSH key generated. Public key:"
  cat /root/.ssh/id_rsa.pub
  echo ""
  echo "Key will be used to register custom subdomain 'hrflowautomation'"
fi

echo "Starting autossh tunnel..."
echo "Forwarding hrflowautomation.serveo.net -> host.docker.internal:4000"
exec autossh -M 0 \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o StrictHostKeyChecking=no \
  -i /root/.ssh/id_rsa \
  -R hrflowautomation:80:host.docker.internal:4000 \
  serveo.net
