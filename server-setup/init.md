Yes. SketchyDraw folder owner `mediautils` rahega. `svc-sketchydraw` sirf read/traverse karega, write nahi karega.

Run on server.

## 1. Create runtime user

```bash
sudo useradd --system \
  --no-user-group \
  --gid nogroup \
  --home-dir /nonexistent \
  --shell /usr/sbin/nologin \
  svc-sketchydraw 2>/dev/null || true
```

Check:

```bash
id svc-sketchydraw
getent passwd svc-sketchydraw
```

Expected:

```txt
/nonexistent:/usr/sbin/nologin
```

## 2. Create SketchyDraw folders on NVMe

```bash
sudo mkdir -p /mnt/media-nvme/sketchydraw/app/releases
sudo mkdir -p /mnt/media-nvme/sketchydraw/app/current
```

## 3. Make deploy user owner

```bash
sudo chown -R mediautils:mediautils /mnt/media-nvme/sketchydraw
```

## 4. Make folder readable/traversable only

```bash
sudo chmod 755 /mnt/media-nvme/sketchydraw
sudo chmod 755 /mnt/media-nvme/sketchydraw/app
sudo chmod 755 /mnt/media-nvme/sketchydraw/app/releases
sudo chmod 755 /mnt/media-nvme/sketchydraw/app/current
```

Meaning:

```txt
mediautils        can write/deploy
svc-sketchydraw   can only read/traverse
others            can read/traverse
```

No secrets in this folder, so readable is fine.

## 5. Create env folder, root only

```bash
sudo mkdir -p /etc/sketchydraw
sudo chown root:root /etc/sketchydraw
sudo chmod 700 /etc/sketchydraw
```

Env file:

```bash
sudo touch /etc/sketchydraw/sketchydraw-api.env
sudo chown root:root /etc/sketchydraw/sketchydraw-api.env
sudo chmod 600 /etc/sketchydraw/sketchydraw-api.env
```

`svc-sketchydraw` ko env file direct read access nahi milega. Systemd root env read karega.

## 6. Verify access

```bash
sudo -u svc-sketchydraw test -r /mnt/media-nvme/sketchydraw && echo "svc-sketchydraw can READ base - GOOD" || echo "svc-sketchydraw cannot read base - BAD"
```

```bash
sudo -u svc-sketchydraw test -w /mnt/media-nvme/sketchydraw && echo "svc-sketchydraw CAN WRITE base - BAD" || echo "svc-sketchydraw cannot write base - GOOD"
```

```bash
sudo -u svc-sketchydraw test -w /mnt/media-nvme/sketchydraw/app && echo "svc-sketchydraw CAN WRITE app - BAD" || echo "svc-sketchydraw cannot write app - GOOD"
```

```bash
sudo -u svc-sketchydraw test -w /mnt/media-nvme/sketchydraw/app/releases && echo "svc-sketchydraw CAN WRITE releases - BAD" || echo "svc-sketchydraw cannot write releases - GOOD"
```

Expected:

```txt
svc-sketchydraw can READ base - GOOD
svc-sketchydraw cannot write base - GOOD
svc-sketchydraw cannot write app - GOOD
svc-sketchydraw cannot write releases - GOOD
```

## Final structure

```txt
/mnt/media-nvme/sketchydraw
  owner: mediautils
  svc-sketchydraw: read only

/mnt/media-nvme/sketchydraw/app/releases
  owner: mediautils
  svc-sketchydraw: read only

/mnt/media-nvme/sketchydraw/app/current
  owner: mediautils
  svc-sketchydraw: read only

/etc/sketchydraw/sketchydraw-api.env
  owner: root
  permission: 600
```

This keeps SketchyDraw stricter than MediaUtils: no uploads, no tmp, no storage, no write access for runtime user.
