# Auto Deploy + Backup Guide (GitHub → Ubuntu Server)

Jab bhi aap code update karke **GitHub `main` branch** par push karoge, server par automatically:
1. **Backup** (database + .env + build)
2. **Git pull** (latest code)
3. **Build** + **PM2 restart**

---

## Flow

```
Mac par code change → git push main → GitHub Actions CI (build test)
                                    → GitHub Actions Deploy (SSH)
                                    → backup.sh (pehle backup)
                                    → deploy.sh (pull + build + restart)
```

---

## Ek baar setup (abhi karo)

### Step 1: Mac par deploy SSH key banao

```bash
ssh-keygen -t ed25519 -C "github-hr-deploy" -f ~/.ssh/hr-project-deploy -N ""
```

### Step 2: Public key server par add karo

```bash
ssh-copy-id -i ~/.ssh/hr-project-deploy.pub -p 56767 root@103.197.77.33
```

Test:

```bash
ssh -i ~/.ssh/hr-project-deploy -p 56767 root@103.197.77.33 "echo OK"
```

### Step 3: GitHub Secrets add karo

Repo: https://github.com/gauravpandey-Bony/Hr-Project  
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|--------|
| `SSH_HOST` | `103.197.77.33` |
| `SSH_PORT` | `56767` |
| `SSH_USER` | `root` |
| `SSH_PRIVATE_KEY` | `cat ~/.ssh/hr-project-deploy` ka poora output |
| `APP_DIR` | `/var/www/hr-project` |
| `BACKUP_ROOT` | `/var/backups/hr-project` |
| `KEEP_BACKUPS` | `30` |

### Step 4: Server par backup folder + deploy scripts

Server par SSH karo aur yeh chalao:

```bash
mkdir -p /var/backups/hr-project
cd /var/www/hr-project
git pull origin main
chmod +x deploy/*.sh
```

### Step 5: Mac se code push karo (pehli baar deploy files ke saath)

```bash
cd "/Users/rampal/Desktop/Ai HR project"
git add .
git commit -m "Add auto-deploy with backup on each update"
git push origin main
```

GitHub → **Actions** tab → workflow **Deploy to Ubuntu Server** dekho.

---

## Roz kaam kaise hoga

```bash
# Mac par — code change ke baad
cd "/Users/rampal/Desktop/Ai HR project"
git add .
git commit -m "your update message"
git push origin main
```

**2-5 minute** mein server par update ho jayega.

Check: http://103.197.77.33

---

## Backup kahan save hota hai

```
/var/backups/hr-project/
├── 2026-06-17_14-30-00/
│   ├── prod.db          ← SQLite database
│   ├── .env             ← environment config
│   ├── next-build.tar.gz
│   ├── git-commit.txt   ← kaun sa commit deploy hua tha
│   └── git-log.txt
├── 2026-06-17_16-45-00/
└── LATEST               ← last backup folder name
```

Har deploy se pehle naya backup. Purane **30 backups** rakhe jate hain (change via `KEEP_BACKUPS` secret).

---

## Rollback (purana version wapas)

Agar naya update problem kare:

```bash
ssh -p 56767 root@103.197.77.33
cd /var/www/hr-project
bash deploy/rollback.sh
```

---

## Manual deploy (bina GitHub ke)

```bash
ssh -p 56767 root@103.197.77.33
cd /var/www/hr-project
bash deploy/deploy.sh
```

---

## Useful commands

| Command | Kaam |
|---------|------|
| `pm2 status` | App running? |
| `pm2 logs nova-hr` | Live logs |
| `ls /var/backups/hr-project/` | Saare backups |
| `bash deploy/rollback.sh` | Last backup restore |

---

## Files

| File | Kaam |
|------|------|
| `.github/workflows/deploy.yml` | Push par auto deploy |
| `.github/workflows/ci.yml` | PR par build check |
| `deploy/backup.sh` | Pre-deploy backup |
| `deploy/deploy.sh` | Pull + build + restart |
| `deploy/rollback.sh` | Restore last backup |
| `deploy/ecosystem.config.cjs` | PM2 config |
