# VPS Setup & Deployment Guide
# Panchang Backend — Self-Hosted MongoDB on Ubuntu VPS

## Step 1: Install MongoDB Community Edition on Ubuntu

Run these commands on your VPS via SSH (copy-paste exactly):

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository for Ubuntu
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org
```

## Step 2: Start MongoDB and Enable Auto-Start on Boot

```bash
# Start MongoDB service now
sudo systemctl start mongod

# Enable auto-start so MongoDB starts automatically after VPS reboots
sudo systemctl enable mongod

# Check MongoDB is running — you should see "active (running)"
sudo systemctl status mongod
```

Expected output:
```
● mongod.service - MongoDB Database Server
   Active: active (running) since ...
```

## Step 3: Verify MongoDB is Working

```bash
# Open the MongoDB shell
mongosh

# Inside the shell — check databases exist
show dbs

# Exit shell
exit
```

## Step 4: Secure MongoDB (IMPORTANT — Bind to Localhost Only)

By default MongoDB listens on all network interfaces.
Since your Node.js app runs on the same VPS, bind it to localhost only.

```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf
```

Find this section and make sure it looks like this:
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1       # ← Only accept connections from this VPS itself
```

Save with Ctrl+O, then Enter, then Ctrl+X.

```bash
# Restart MongoDB to apply the change
sudo systemctl restart mongod

# Confirm it's still running
sudo systemctl status mongod
```

> **Why 127.0.0.1?** This means only programs running ON the same VPS can connect.
> No external IP can reach MongoDB. This is the correct setup for a backend that
> runs alongside MongoDB on the same server.

## Step 5: Copy Project to VPS

```bash
# On your local Windows machine — copy the project up
scp -r "C:\Users\ganta\OneDrive\Desktop\panchang\backend" user@YOUR_VPS_IP:/home/user/panchang/

# OR using rsync (better for updates)
rsync -avz "C:\Users\ganta\OneDrive\Desktop\panchang\backend/" user@YOUR_VPS_IP:/home/user/panchang/backend/
```

## Step 6: Fill in .env on the VPS

```bash
# SSH into VPS
ssh user@YOUR_VPS_IP

# Edit .env
nano /home/user/panchang/backend/.env
```

Fill in your real API keys. The MONGO_URI is already correct for VPS:
```
MONGO_URI=mongodb://127.0.0.1:27017/panchang
FREE_CLIENT_ID=your_actual_free_client_id
FREE_CLIENT_SECRET=your_actual_free_client_secret
PAID_CLIENT_ID=your_actual_paid_client_id
PAID_CLIENT_SECRET=your_actual_paid_client_secret
DB_WARN_GB=10
```

## Step 7: Install Node.js and Dependencies

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # Should show v20.x.x
npm --version

# Install project dependencies
cd /home/user/panchang/backend
npm install
```

## Step 8: Install PM2 and Start the App

```bash
# Install PM2 globally
npm install -g pm2

# Start the app using PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list (so it restarts after VPS reboot)
pm2 save

# Set PM2 to auto-start on VPS boot
pm2 startup
# → Run the command it prints (starts with "sudo env PATH=...")
```

## Step 9: Check Everything is Running

```bash
# Check PM2 process list — should show "online"
pm2 list

# Watch live logs
pm2 logs panchang-backend

# Test server is responding
curl http://localhost:5000/api/system/db-stats
```

---

## Backup and Restore

### Create a Backup (mongodump)

```bash
# Create a backup of the entire panchang database
# Saves to /home/user/backups/panchang-YYYY-MM-DD folder
mongodump --db panchang --out /home/user/backups/panchang-$(date +%Y-%m-%d)
```

**Schedule daily backups with cron:**
```bash
crontab -e
```
Add this line to run backup every day at 3 AM:
```
0 3 * * * mongodump --db panchang --out /home/user/backups/panchang-$(date +\%Y-\%m-\%d) --gzip
```

### Restore from Backup (mongorestore)

```bash
# Restore from a specific backup folder
mongorestore --db panchang /home/user/backups/panchang-2026-02-21/panchang

# If backup was made with --gzip flag
mongorestore --db panchang --gzip /home/user/backups/panchang-2026-02-21/panchang
```

> **WARNING:** mongorestore ADDS data on top of existing data.
> If you want a clean restore, drop the DB first:
> ```bash
> mongosh --eval 'use panchang; db.dropDatabase();'
> mongorestore --db panchang /home/user/backups/...
> ```

---

## Useful Commands (Day-to-Day)

```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Restart MongoDB (if it stops)
sudo systemctl restart mongod

# Check disk usage on VPS
df -h

# Check MongoDB database size from shell
mongosh --eval 'use panchang; db.stats()' | grep -E "dataSize|storageSize|indexSize"

# Check via API (while app is running)
curl http://localhost:5000/api/system/db-stats

# View PM2 app status
pm2 list

# Restart app
pm2 restart panchang-backend

# View last 100 log lines
pm2 logs panchang-backend --lines 100
```

---

## Confirming Data is Being Stored

```bash
# Open MongoDB shell
mongosh

# Switch to panchang database
use panchang

# Count documents in Panchang collection
db.Panchang.countDocuments()

# See the most recently added document
db.Panchang.findOne({}, {}, { sort: { _id: -1 } })

# Count across all collections
db.Panchang.countDocuments()
db.Muhurat.countDocuments()
db.Kundali.countDocuments()
db.HinduTime.countDocuments()
db.Compass.countDocuments()

# Exit shell
exit
```

---

## When You Receive VPS Details — Checklist

When you get your VPS (IP address, root password/SSH key), do this in order:

1. SSH into VPS: `ssh root@YOUR_VPS_IP`
2. Create a non-root user (optional but recommended)
3. Install MongoDB (Step 1-4 above)
4. Install Node.js (Step 7 above)
5. Copy project files to VPS (Step 5)
6. Fill in `.env` with your actual API keys (Step 6)
7. Run `npm install` (Step 7)
8. Install PM2 and start the app (Step 8)
9. Test with `curl http://localhost:5000/api/system/db-stats`
10. Trigger year 2026 fetch: `curl http://localhost:5000/api/prokerala/year/2026`
11. Monitor progress: `curl http://localhost:5000/api/prokerala/year/2026/status`
