#!/bin/bash
set -e

echo "================================================"
echo "MongoDB Vector Search POC - Container Startup (PM2)"
echo "================================================"

cd /opt/mongo_vector_search_poc

echo "[1/8] Installing MongoDB 8.2..."
if ! command -v mongod &> /dev/null; then
   apt-get update -qq
   apt-get install -y wget gnupg curl ca-certificates lsb-release

   # Add MongoDB GPG key and repository for 8.2
   curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
   echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] http://repo.mongodb.org/apt/debian $(lsb_release -cs)/mongodb-org/8.2 main" | tee /etc/apt/sources.list.d/mongodb-org-8.2.list
  
   apt-get update -qq
   apt-get install -y mongodb-org=8.2.2 mongodb-org-database=8.2.2 mongodb-org-server=8.2.2 mongodb-org-mongos=8.2.2 mongodb-org-tools=8.2.2 mongodb-mongosh
  
   echo "✓ MongoDB 8.2.2 installed"
else
   MONGO_VERSION=$(mongod --version | head -1)
   echo "✓ MongoDB already installed ($MONGO_VERSION)"
fi

echo "[2/8] Creating MongoDB data directories..."
mkdir -p /data/db /data/configdb /var/log/mongodb
echo "✓ Directories created"

echo "[3/8] Setting up MongoDB keyfile..."
cp ./mongodb-keyfile /etc/mongodb-keyfile 2>/dev/null || true
chmod 400 /etc/mongodb-keyfile
echo "✓ Keyfile configured"

echo "[4/8] Preparing PM2..."
# Ensure Node.js and npm are available first (needed for pm2)
if ! command -v npm &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Stop any existing processes
pm2 delete all 2>/dev/null || true
pkill -9 mongod 2>/dev/null || true
pkill -9 mongot 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

echo "Starting MongoDB via PM2..."
pm2 start ecosystem.config.js --only mongodb
echo "✓ MongoDB started"

echo "[5/8] Initializing replica set and users..."
echo "Waiting for MongoDB to accept connections..."
until mongosh --quiet --eval "db.runCommand('ping').ok" &>/dev/null; do
    sleep 1
done

mongosh --quiet --eval "try { rs.status(); } catch(e) { rs.initiate(); }" 2>/dev/null || true
sleep 3

mongosh --quiet --eval "
try {
   db.getSiblingDB('admin').auth('admin', 'password123');
} catch(e) {
   db.getSiblingDB('admin').createUser({
       user: 'admin',
       pwd: 'password123',
       roles: ['root']
   });
}
" 2>/dev/null || true

mongosh -u admin -p password123 --authenticationDatabase admin --quiet --eval "
db = db.getSiblingDB('admin');
try {
   db.getUser('mongotUser');
} catch(e) {
   db.createUser({
       user: 'mongotUser',
       pwd: 'password123',
       roles: [{ role: 'searchCoordinator', db: 'admin' }],
       mechanisms: ['SCRAM-SHA-1', 'SCRAM-SHA-256']
   });
}
" 2>/dev/null || true

echo "✓ MongoDB configured"

echo "[6/8] Preparing mongot..."
mkdir -p /var/lib/mongot
chmod +x ./mongot-community/mongot
chmod +x ./mongot-community/bin/jdk/bin/java
chmod 400 ./mongot-password.txt

echo "Starting mongot via PM2..."
pm2 start ecosystem.config.js --only mongot
echo "✓ mongot started"

echo "[7/8] Installing Node.js dependencies..."
npm install --silent 2>/dev/null || npm install
echo "✓ Dependencies installed"

echo "[8/8] Updating environment and starting Next.js..."
sed -i 's/mongodb:27017/localhost:27017/g' .env.local
pm2 start ecosystem.config.js --only nextjs
echo "✓ Next.js started"

echo ""
echo "================================================"
echo "All services started with PM2!"
echo "================================================"
pm2 save
pm2 status
