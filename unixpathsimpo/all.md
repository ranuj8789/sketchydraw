Ranuj, first **do not paste secrets** like passwords, API keys, JWT secrets, DB passwords. Use these commands; they mask sensitive values.

## 1. Important SketchyDraw paths to check

Most likely paths should be like this:

```bash
/opt/sketchydraw
/opt/sketchydraw/releases
/opt/sketchydraw/current
/opt/sketchydraw/logs
/opt/sketchydraw/storage

/etc/sketchydraw
/etc/sketchydraw/sketchydraw-api.env

/etc/systemd/system/sketchydraw-api.service

/var/www/sketchydraw-ui
/etc/nginx/sites-available/sketchydraw
/etc/nginx/sites-enabled/sketchydraw
```

Run:

```bash
sudo ls -la /opt | grep -i sketch
sudo find /opt -maxdepth 3 -iname "*sketch*" -ls
sudo find /etc -maxdepth 3 -iname "*sketch*" -ls
sudo find /var/www -maxdepth 3 -iname "*sketch*" -ls
```

---

## 2. Check `/opt/sketchydraw` access

```bash
echo "=== /opt/sketchydraw tree permissions ==="
sudo namei -l /opt/sketchydraw
sudo ls -ld /opt/sketchydraw
sudo find /opt/sketchydraw -maxdepth 3 -printf "%M %u:%g %p\n" | sort
```

Expected style:

```bash
/opt/sketchydraw                 root:root              755 or 750
/opt/sketchydraw/releases        mediautils/sketch user  750
/opt/sketchydraw/current         deploy user/app group
/opt/sketchydraw/logs            service-user:app-group 750
/opt/sketchydraw/storage         service-user:app-group 750
```

Red flags:

```bash
777
world-writable
.env inside /opt
secrets readable by normal users
service running as root
```

Check writable files:

```bash
echo "=== World writable files under SketchyDraw ==="
sudo find /opt/sketchydraw -perm -0002 -ls

echo "=== Executable files in storage/log/tmp ==="
sudo find /opt/sketchydraw/storage /opt/sketchydraw/logs -type f -perm /111 -ls 2>/dev/null
```

---

## 3. Check `.env` access

```bash
echo "=== Env directory/file permissions ==="
sudo ls -ld /etc/sketchydraw
sudo ls -l /etc/sketchydraw
sudo namei -l /etc/sketchydraw/sketchydraw-api.env
```

Mask env values safely:

```bash
echo "=== Masked env keys ==="
sudo sed -E 's/(PASSWORD|SECRET|KEY|TOKEN|PRIVATE|CLIENT_SECRET|RAZORPAY|CASHFREE|JWT|DB_PASS|DATABASE_URL)([^=]*)=.*/\1\2=***MASKED***/Ig' /etc/sketchydraw/sketchydraw-api.env
```

Expected:

```bash
/etc/sketchydraw                  root:sketchydraw-secrets 750
/etc/sketchydraw/sketchydraw-api.env root:sketchydraw-secrets 640
```

Red flag:

```bash
-rw-r--r--
-rwxrwxrwx
owned by app user directly
stored inside /var/www or git folder
```

---

## 4. Check systemd service access

```bash
echo "=== Systemd unit ==="
sudo systemctl cat sketchydraw-api

echo "=== Service status ==="
sudo systemctl status sketchydraw-api --no-pager

echo "=== Runtime user ==="
ps -eo user,group,pid,ppid,etime,cmd | grep -i '[s]ketch'
```

Expected important lines:

```ini
User=svc-sketchydraw
Group=sketchydraw-app
EnvironmentFile=/etc/sketchydraw/sketchydraw-api.env
WorkingDirectory=/opt/sketchydraw
ExecStart=/usr/bin/java -jar /opt/sketchydraw/current/sketchydraw-api.jar
Restart=always
```

Red flag:

```ini
User=root
Environment=DB_PASSWORD=plain-password-inside-unit
ExecStart from /tmp
WorkingDirectory=/home/...
```

---

## 5. Check who can access service user / groups

```bash
echo "=== Users and groups related to sketch ==="
getent passwd | grep -Ei 'sketch|svc|media'
getent group | grep -Ei 'sketch|svc|media|secret'

echo "=== Members of important groups ==="
for g in $(getent group | grep -Ei 'sketch|media|secret' | cut -d: -f1); do
  echo "--- $g ---"
  getent group "$g"
done
```

Also check sudo access:

```bash
echo "=== Sudoers files ==="
sudo ls -l /etc/sudoers.d
sudo grep -R "sketch\|media\|svc\|NOPASSWD" /etc/sudoers /etc/sudoers.d 2>/dev/null
```

Red flags:

```bash
svc-sketchydraw ALL=(ALL) NOPASSWD:ALL
mediautils ALL=(ALL) NOPASSWD:ALL
service user has shell /bin/bash
too many users inside secrets group
```

---

## 6. Check Nginx access and public paths

```bash
echo "=== Nginx sketch configs ==="
sudo grep -R "sketch\|server_name\|proxy_pass\|root" /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null

echo "=== Web root permissions ==="
sudo ls -ld /var/www/sketchydraw-ui
sudo find /var/www/sketchydraw-ui -maxdepth 2 -printf "%M %u:%g %p\n" | sort | head -100
```

Expected:

```bash
/var/www/sketchydraw-ui root:root 755
static files readable
not writable by nginx/app user
```

Red flag:

```bash
.env in /var/www
backend jar in /var/www
uploads served directly without control
```

Check:

```bash
sudo find /var/www/sketchydraw-ui -iname "*.env" -o -iname "*secret*" -o -iname "*key*"
```

---

## 7. Check DB access from env

First get DB values safely:

```bash
echo "=== DB-related env keys only masked ==="
sudo grep -Ei "DB|DATABASE|POSTGRES|SPRING_DATASOURCE" /etc/sketchydraw/sketchydraw-api.env \
| sed -E 's/(PASSWORD|SECRET|KEY|TOKEN)([^=]*)=.*/\1\2=***MASKED***/Ig'
```

Then check PostgreSQL roles:

```bash
echo "=== PostgreSQL roles ==="
sudo -u postgres psql -c "\du"
```

Check SketchyDraw database permissions:

```bash
echo "=== Databases ==="
sudo -u postgres psql -c "\l"

echo "=== SketchyDraw DB privileges ==="
sudo -u postgres psql -c "\l+" | grep -i sketch
```

If DB name is `sketchydraw`, run:

```bash
sudo -u postgres psql -d sketchydraw -c "
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
ORDER BY grantee, privilege_type;
"
```

Check table owners:

```bash
sudo -u postgres psql -d sketchydraw -c "
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname='public'
ORDER BY tablename;
"
```

Check active DB connections:

```bash
sudo -u postgres psql -c "
SELECT 
  datname,
  usename,
  client_addr,
  application_name,
  state,
  count(*)
FROM pg_stat_activity
GROUP BY datname, usename, client_addr, application_name, state
ORDER BY count(*) DESC;
"
```

Expected:

```bash
app DB user should not be postgres
app DB user should only access sketchydraw DB
no remote unknown client_addr
no public/trust access
```

Red flags:

```bash
application uses postgres superuser
DB user has SUPERUSER
DB user can CREATEDB/CREATEROLE
Postgres exposed publicly on 0.0.0.0:5432
```

---

## 8. Check PostgreSQL network exposure

```bash
echo "=== Postgres listening ports ==="
sudo ss -lntp | grep 5432

echo "=== PostgreSQL config listen address ==="
sudo -u postgres psql -c "SHOW listen_addresses;"
sudo -u postgres psql -c "SHOW hba_file;"
sudo -u postgres psql -c "SHOW config_file;"
```

Then:

```bash
HBA_FILE=$(sudo -u postgres psql -tAc "SHOW hba_file;")
echo "$HBA_FILE"
sudo cat "$HBA_FILE"
```

Expected:

```bash
listen_addresses = localhost
or internal LAN only
```

Red flag:

```bash
listen_addresses = '*'
host all all 0.0.0.0/0 md5
host all all 0.0.0.0/0 trust
```

---

## 9. Check open ports

```bash
echo "=== Open listening ports ==="
sudo ss -lntup

echo "=== UFW status ==="
sudo ufw status verbose
```

Expected public:

```bash
443 open
80 optional only for redirect/certbot
SSH restricted
8080 not public
5432 not public
6379 not public
```

Red flags:

```bash
0.0.0.0:8080
0.0.0.0:5432
0.0.0.0:6379
0.0.0.0:3000
```

---

## 10. One-shot audit command

Run this and paste output:

```bash
echo "===== SKETCHYDRAW AUDIT $(date) ====="

echo "\n--- PATHS ---"
sudo find /opt /etc /var/www -maxdepth 3 -iname "*sketch*" -ls 2>/dev/null

echo "\n--- OPT PERMISSIONS ---"
sudo find /opt/sketchydraw -maxdepth 3 -printf "%M %u:%g %p\n" 2>/dev/null | sort

echo "\n--- WORLD WRITABLE ---"
sudo find /opt/sketchydraw /etc/sketchydraw /var/www/sketchydraw-ui -perm -0002 -ls 2>/dev/null

echo "\n--- ENV FILE ---"
sudo ls -ld /etc/sketchydraw 2>/dev/null
sudo ls -l /etc/sketchydraw 2>/dev/null
sudo sed -E 's/(PASSWORD|SECRET|KEY|TOKEN|PRIVATE|CLIENT_SECRET|RAZORPAY|CASHFREE|JWT|DB_PASS|DATABASE_URL)([^=]*)=.*/\1\2=***MASKED***/Ig' /etc/sketchydraw/sketchydraw-api.env 2>/dev/null

echo "\n--- SYSTEMD ---"
sudo systemctl cat sketchydraw-api 2>/dev/null
sudo systemctl status sketchydraw-api --no-pager 2>/dev/null | head -40

echo "\n--- PROCESS ---"
ps -eo user,group,pid,ppid,etime,cmd | grep -i '[s]ketch'

echo "\n--- USERS/GROUPS ---"
getent passwd | grep -Ei 'sketch|svc|media'
getent group | grep -Ei 'sketch|svc|media|secret'

echo "\n--- SUDOERS RELATED ---"
sudo grep -R "sketch\|media\|svc\|NOPASSWD" /etc/sudoers /etc/sudoers.d 2>/dev/null

echo "\n--- NGINX ---"
sudo grep -R "sketch\|server_name\|proxy_pass\|root" /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null

echo "\n--- PORTS ---"
sudo ss -lntup

echo "\n--- UFW ---"
sudo ufw status verbose

echo "\n--- POSTGRES ROLES ---"
sudo -u postgres psql -c "\du" 2>/dev/null

echo "\n--- POSTGRES DATABASES ---"
sudo -u postgres psql -c "\l" 2>/dev/null

echo "\n--- POSTGRES LISTEN ---"
sudo -u postgres psql -c "SHOW listen_addresses;" 2>/dev/null

echo "\n--- POSTGRES ACTIVE CONNECTIONS ---"
sudo -u postgres psql -c "
SELECT datname, usename, client_addr, application_name, state, count(*)
FROM pg_stat_activity
GROUP BY datname, usename, client_addr, application_name, state
ORDER BY count(*) DESC;
" 2>/dev/null
```

Paste this output after masking anything sensitive. I’ll check:

1. who can read env/secrets
2. who can write release/current jar
3. whether service runs as root or safe user
4. whether DB user is overpowered
5. whether Postgres/Redis/API ports are exposed
6. whether Nginx is safely serving only frontend and proxying backend.
