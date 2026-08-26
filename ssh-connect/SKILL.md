---
name: ssh-connect
description: Guide for configuring and using SSH connections in iOS Scripting environment. Explains key-based authentication requirements and provides helper scripts.
metadata:
  display_name: "SSH Connect"
  intent_patterns: "ssh connect, ssh server, remote server, ssh key, generate ssh key, ssh config, ios_popen failed"
  required_tools: "run_shell_command"
---

# Purpose

Use this skill when the user wants to:
- Connect to a remote server via SSH
- Generate SSH keys
- Troubleshoot SSH connection issues (especially `ios_popen failed`)
- Execute commands on remote servers

# Background

SSH invoked via `ios_system` on iOS (OpenSSH 8.5p1) has the following characteristics:

1. Password authentication is unreliable -- interactive input often fails.
2. Prefer key-based authentication, combined with `-T` to disable pseudo-terminal allocation.
3. `/etc/ssh/` does not exist on iOS; this is normal and does not affect functionality.
4. SSH config, keys, and known_hosts are all read from `$HOME/Documents/.ssh/`. Place files there and they will be picked up automatically.

# Instructions

## Recommended Parameters

```bash
ssh -T -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 user@host "command"
```

| Parameter | Purpose |
|-----------|---------|
| `-T` | Disable pseudo-terminal allocation; should always be used on iOS |
| `-o BatchMode=yes` | Non-interactive mode; no password prompt |
| `-o StrictHostKeyChecking=no` | Auto-accept new host keys |
| `-o ConnectTimeout=10` | 10-second connection timeout |

Keys and known_hosts in `$HOME/Documents/.ssh/` are detected automatically. Explicit `-i` or `-o UserKnownHostsFile` are usually unnecessary.

## Workflow

Core principle: try connecting first. If a key already exists and the server already has it authorized, the connection will succeed on the first attempt. Only fall back to key generation if the connection fails.

### Step 1 (always first): Try connecting

Regardless of known configuration, the agent should always run this first:

```bash
ssh -T -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 user@host "echo connected"
```

- Output `connected` -- connection works. Skip to Step 5.
- Output `Permission denied (publickey)` -- key not authorized on server. Proceed to Step 2.
- Output `ios_popen failed` -- often caused by complex quoting or escaping, not just missing `-T`. Simplify the command to the minimal version first.
- Output `Connection refused / timed out` -- network or firewall issue, unrelated to keys.
- Output `Host key verification failed` -- add `-o StrictHostKeyChecking=no` and retry.

### Step 2 (only if Step 1 failed with key error): Check local keys

```bash
ls -la $HOME/Documents/.ssh/
```

Check whether `id_ed25519` or `id_rsa` exists, and whether `config` contains a matching Host entry. If a usable key exists, retry Step 1. Only proceed to Step 3 if no key is found.

### Step 3 (only if no key exists): Generate a key

```bash
ssh-keygen -t ed25519 -f $HOME/Documents/.ssh/id_ed25519 -N "" -q
cat $HOME/Documents/.ssh/id_ed25519.pub
```

### Step 4 (only if Step 1 failed): Deploy the public key

This requires manual user action (since automatic login is not yet available). Append the public key to the server:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo '<public key content>' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

After deployment, return to Step 1 and retry.

### Step 5: Execute remote commands

```bash
ssh -T -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 user@host "command"
```

## Troubleshooting

### `ios_popen failed`

Not just a missing `-T` issue. On iOS, nested single quotes, Go template braces, and complex `awk`/`sed` expressions can all trigger this. Reduce the ssh command to the minimal version (`ssh -T ... "echo connected"`) to verify the link, then add complexity incrementally.

### `Permission denied (publickey)`

The server does not have the public key. Add it to `~/.ssh/authorized_keys` on the server.

### `Host key verification failed`

Add `-o StrictHostKeyChecking=no` to the command.

### Where are the keys?

In `$HOME/Documents/.ssh/`. OpenSSH automatically reads `id_ed25519`, `id_rsa`, and other key files from this directory.

### `kex_exchange_identification: Connection closed by remote host`

TCP connects but the handshake is immediately closed by the server before authentication. Common causes, ordered by likelihood:

1. **Outbound IP blocked by server-side rules.** This is the most common cause. iOS switching VPN/proxy changes the outbound IP (check `nc -zv` output for the `outif` field: `pdp_ip0` = cellular, `utun*` = VPN). The server may have:
   - Cloud provider security group IP whitelist
   - `fail2ban` active
   - `sshd` AllowUsers/Match Address or hosts.allow/deny restrictions
   - Cloud DDoS/threat intelligence blocking foreign IPs

   Diagnostic: run `curl https://ifconfig.me` to check the current outbound IP, then switch networks (disable VPN or switch to cellular) and retry immediately.

2. Too many recent login attempts triggered a temporary fail2ban ban (usually self-recovers in ~10 minutes).
3. `sshd_config` has overly strict `MaxStartups` or `LoginGraceTime` settings.

## iOS-Specific Pitfalls

### 1. Hidden triggers for `ios_popen failed`

Beyond missing `-T`, certain characters in the command line cause `ios_system` to fail before the process even starts:

- **Nested single quotes.** Writing `'xxx'` inside a remote command commonly fails. Workaround: wrap the entire remote command in double quotes, use backslash escapes for literals, or write complex commands into a script on the server and invoke that script.
- **Go template braces.** `docker inspect -f '{{.X}}' name` gets mangled. Workaround: drop `-f` and use `docker inspect name | grep` instead.
- **Complex `sed`/`awk` expressions.** Separator and escape combinations are extremely hard to pass correctly through the iOS shell. Workaround: generate the final file locally with FileTool, then upload via `cat file | ssh host "cat > /remote/path"`.

### 2. `scp` cannot overwrite existing remote files

On iOS `ios_system`, `scp local remote:/existing/file` reports `Not a directory` even when the target is a regular file. The recommended file transfer pattern:

```bash
# Pipe-based transfer (supports overwrite, no temp directory needed)
cat local.conf | ssh -T -o BatchMode=yes user@host "cat > /remote/path/file"

# Then move/copy to final location on the server if needed
ssh -T -o BatchMode=yes user@host "cp /root/new.conf /etc/nginx/conf.d/file && nginx -t"
```

### 3. Common commands may not exist

The `ios_system` command set is limited. Do not assume `sleep`, `which`, or `timeout` are available. If waiting is needed, let the next ssh invocation handle retry logic on its own.

### 4. Top-level pipes (`|`) are natively supported — with stderr / timeout caveats

Multi-segment pipelines are now safe to write directly, e.g.

```bash
ssh -T -o BatchMode=yes user@host "docker exec X printenv" | grep -E 'APNS|GITHUB|PUSH_API'
```

On the Swift side, `AppIOSSystemShellService` splits the command on top-level `|` boundaries and runs each segment through `ios_system` independently, bridging stage outputs through tempfiles + `<` input redirection. This sidesteps the long-standing `ios_system` parser failure on three layers of nested quotes (outer `'...'` + remote command with `"..."` + grep pattern containing `|`).

Caveats:

1. **Stage stderr is merged into the next stage's stdin.** Every segment is run with `2>&1` internally, so any stderr from an upstream segment ends up in the bridging file and feeds into the downstream segment. When strict stderr isolation matters, redirect it explicitly inside the remote command:

   ```bash
   ssh ... "docker exec X printenv 2>/dev/null" | grep ...
   ```

2. **`||` / `&&` / `;` are not handled by the splitter (yet).** Commands containing those connectors are passed to `ios_system` whole, preserving short-circuit semantics as-is. If you need both pipes and short-circuit logic, push the short-circuit into the remote command and let the local side handle only the pipe.

3. **Per-stage timeout is not amortized.** The whole pipeline can take up to `N × per-stage-timeout`. For long chains (three-plus segments combined with a slow remote call) budget accordingly, or split into multiple ssh invocations.

## Safe Remote Configuration Editing

When modifying service configurations (nginx, sshd, system configs), follow this sequence to avoid locking yourself out:

```bash
# 1. Generate the complete new config locally with FileTool (avoid sed/awk on iOS)

# 2. Back up on the server with a date suffix
ssh ... "cp -a /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak.$(date +%Y%m%d)"

# 3. Pipe the new file to a staging directory (avoids scp limitations)
cat new.conf | ssh ... "cat > /root/new.conf"

# 4. Copy to target and dry-run validation
ssh ... "cp /root/new.conf /etc/nginx/conf.d/default.conf && nginx -t"

# 5. Reload only after validation passes (confirm process is still running)
ssh ... "nginx -s reload && docker ps --filter name=nginx"

# 6. Run verification commands (curl, check response headers, etc.)
```

For `sshd_config` changes, the risk is higher. Open a `screen` or `tmux` session to maintain the current login, run `sshd -t` to validate before reloading, and immediately verify a new login works in a separate window before closing the old one.

## Example: Agent SSH Usage

Recommended flow: try connecting first; if it works, use it directly; if not, troubleshoot.

```bash
# 1. Always start here: try connecting
ssh -T -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@1.2.3.4 "echo connected"

# If output is "connected", skip to step 4.

# 2. Only if step 1 failed with publickey: check existing keys
ls $HOME/Documents/.ssh/

# If no usable key, generate a new one
ssh-keygen -t ed25519 -f $HOME/Documents/.ssh/id_ed25519 -N "" -q
cat $HOME/Documents/.ssh/id_ed25519.pub   # Have the user add this to the server

# 3. After user completes authorization, retry step 1

# 4. Once connected, execute the needed command
ssh -T -o BatchMode=yes -o ConnectTimeout=10 root@1.2.3.4 "uname -a && df -h"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/check-ssh-status.sh` | Check SSH environment configuration status |
| `scripts/generate-key.sh` | Generate a new SSH key pair |
| `scripts/test-connection.sh` | Test whether SSH connection works |
