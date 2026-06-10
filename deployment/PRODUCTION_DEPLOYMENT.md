# Production Deployment Guide

This guide covers deploying the Canar Profile Builder application to production on EC2 with multiple deployment options.

## 🚀 Deployment Options

### 1. **EC2 with PM2 (Recommended)**

- Traditional server deployment
- Full control over infrastructure
- Cost-effective for small to medium scale

### 2. **Docker Compose**

- Containerized deployment
- Easy scaling and management
- Consistent environment

### 3. **Docker Swarm/Kubernetes**

- For large-scale deployments
- High availability and auto-scaling
- Advanced orchestration

## 📋 Prerequisites

### EC2 Instance Requirements

- **OS**: Ubuntu 20.04 LTS or later
- **Instance Type**: t3.medium or larger
- **Storage**: 20GB+ SSD
- **Security Groups**:
  - SSH (22)
  - HTTP (80)
  - HTTPS (443)
  - Custom TCP (3000) - for direct access

### Domain & SSL

- Registered domain name
- DNS configured to point to EC2 IP
- SSL certificate (Let's Encrypt)

## 🔧 EC2 Deployment (PM2)

### Step 1: Launch EC2 Instance

1. Launch Ubuntu 20.04 LTS instance
2. Configure security groups
3. Generate/download key pair
4. Connect via SSH

### Step 2: Run Deployment Script

```bash
# Clone repository
git clone https://github.com/your-username/canar-profile-builder.git
cd canar-profile-builder

# Make deployment script executable
chmod +x deploy.sh

# Edit configuration
nano deploy.sh
# Update: DOMAIN="your-domain.com"

# Run deployment
./deploy.sh
```

### Step 3: Configure Environment

```bash
# Edit environment variables
nano .env

# Required variables:
NODE_ENV=production
DATABASE_URL=postgresql://username:password@localhost:5432/canar_prod
JWT_SECRET=your-super-secure-production-secret
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET_NAME=your-bucket-name
CORS_ORIGIN=https://your-domain.com
```

### Step 4: Set Up Database

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE canar_prod;
CREATE USER canar_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE canar_prod TO canar_user;
\q

# Update DATABASE_URL in .env
```

### Step 5: Start Application

```bash
# Build and start with PM2
npm run build
npm run pm2:start

# Check status
npm run pm2:monit
```

## 🐳 Docker Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Option 2: Docker Only

```bash
# Build image
docker build -t canar-profile-builder .

# Run container
docker run -d \
  --name canar-app \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/logs:/app/logs \
  canar-profile-builder
```

## 🔒 Security Configuration

### 1. **Firewall Setup**

```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

### 2. **SSL Certificate**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 3. **Environment Security**

- Use strong, unique secrets
- Rotate secrets regularly
- Use AWS IAM roles when possible
- Enable CloudTrail for audit logs

## 📊 Monitoring & Logging

### PM2 Monitoring

```bash
# View application status
pm2 status

# Monitor resources
pm2 monit

# View logs
pm2 logs canar-profile-builder

# Restart application
pm2 restart canar-profile-builder
```

### System Monitoring

```bash
# Check system resources
htop
df -h
free -h

# Check application logs
tail -f logs/combined.log
tail -f logs/error.log
```

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Database health
pg_isready -h localhost -p 5432 -U canar_user
```

## 🔄 Backup Strategy

### Automated Backups

```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# File backup
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/

# S3 backup (if using S3)
aws s3 sync uploads/ s3://your-backup-bucket/uploads/
```

### Backup Script

The deployment script creates a daily backup cron job:

```bash
# Manual backup
./backup.sh

# Check backup directory
ls -la /var/backups/canar-profile-builder/
```

## 🚀 Scaling Considerations

### Vertical Scaling

- Increase EC2 instance size
- Add more CPU/RAM
- Upgrade storage to SSD

### Horizontal Scaling

- Use load balancer (ALB/ELB)
- Multiple EC2 instances
- Database read replicas
- Redis clustering

### Performance Optimization

- Enable Nginx caching
- Use CDN for static assets
- Database query optimization
- Image compression

## 🔧 Maintenance

### Regular Updates

```bash
# Update application
git pull origin main
npm install
npm run build
pm2 restart canar-profile-builder

# Update system
sudo apt update && sudo apt upgrade

# Update SSL certificate
sudo certbot renew
```

### Log Rotation

```bash
# Check log rotation
sudo logrotate -d /etc/logrotate.d/canar-profile-builder

# Manual log rotation
sudo logrotate -f /etc/logrotate.d/canar-profile-builder
```

### Database Maintenance

```bash
# Vacuum database
sudo -u postgres psql -d canar_prod -c "VACUUM ANALYZE;"

# Check database size
sudo -u postgres psql -d canar_prod -c "SELECT pg_size_pretty(pg_database_size('canar_prod'));"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Application Won't Start**

```bash
# Check logs
pm2 logs canar-profile-builder

# Check environment
pm2 env canar-profile-builder

# Restart application
pm2 restart canar-profile-builder
```

#### 2. **Database Connection Issues**

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql
```

#### 3. **Nginx Issues**

```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/error.log
```

#### 4. **SSL Certificate Issues**

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew --dry-run
```

### Performance Issues

```bash
# Check memory usage
free -h

# Check disk usage
df -h

# Check CPU usage
top

# Check network connections
netstat -tulpn
```

## 📈 Production Checklist

### Before Deployment

- [ ] Environment variables configured
- [ ] Database set up and tested
- [ ] S3 bucket configured
- [ ] Domain DNS configured
- [ ] SSL certificate obtained
- [ ] Firewall configured
- [ ] Monitoring set up

### After Deployment

- [ ] Application accessible via HTTPS
- [ ] Health check endpoint responding
- [ ] File uploads working
- [ ] Database connections stable
- [ ] Logs being generated
- [ ] Backups running
- [ ] Monitoring alerts configured

### Regular Maintenance

- [ ] Weekly security updates
- [ ] Monthly SSL certificate renewal
- [ ] Quarterly backup testing
- [ ] Monthly performance review
- [ ] Quarterly security audit

## 🆘 Emergency Procedures

### Application Down

1. Check PM2 status: `pm2 status`
2. Restart application: `pm2 restart canar-profile-builder`
3. Check logs: `pm2 logs canar-profile-builder`
4. Check system resources: `htop`

### Database Issues

1. Check PostgreSQL: `sudo systemctl status postgresql`
2. Restart database: `sudo systemctl restart postgresql`
3. Check connections: `netstat -an | grep 5432`

### Server Issues

1. Check system logs: `sudo journalctl -xe`
2. Check disk space: `df -h`
3. Check memory: `free -h`
4. Restart server if necessary

## 📞 Support

For deployment issues:

1. Check application logs
2. Review system logs
3. Test individual components
4. Check monitoring dashboards
5. Contact system administrator

## 🔗 Useful Commands

```bash
# Application management
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
npm run pm2:logs
npm run pm2:monit

# Docker management
docker-compose up -d
docker-compose down
docker-compose logs -f

# System management
sudo systemctl status nginx
sudo systemctl status postgresql
sudo ufw status

# Monitoring
htop
df -h
free -h
netstat -tulpn
```
