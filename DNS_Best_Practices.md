# 📖 DNS Best Practices Guide

**Version:** 1.0  
**Date:** 2024  
**Objective:** Properly manage a set of domains, subdomains, and services without conflicts

---
## ✅ Executive Summary

### The 5 Golden Rules:

1. **One CNAME = Alone of its type** (never with A, MX, TXT, etc.)
2. **MX/NS point to A/AAAA** (never CNAME)
3. **No CNAME chains** (1 level maximum)
4. **Consistent TTLs** for similar records
5. **DNS view segregation** (RFC 1918: private IPs only internally)

### Validation Workflow:

1. Design → Check recommended patterns
2. Configuration → Validate syntax and RFC rules
3. Testing → dig, nslookup, online validation
4. Deployment → Reduce TTL before changes
5. Monitoring → Track metrics and alerts
6. Documentation → Update diagrams and notes

---

## 🎯 Fundamental Principles

### 1. One Type per Name (The Golden Rule)
**RFC 1034/1035 Principle:**  
A DNS name can have only **ONE SINGLE TYPE** of primary record.

❌ **FORBIDDEN:**
```dns
www.example.com.    IN  A        192.168.1.10
www.example.com.    IN  CNAME    server.example.com.
```

✅ **CORRECT:**
```dns
www.example.com.    IN  CNAME    server.example.com.
server.example.com. IN  A        192.168.1.10
```

---

## 🚫 Strict RFC Rules to Follow

### Rule #1: CNAME is Exclusive
A **CNAME** record can **NEVER** coexist with other types.

#### ❌ Common Violations:
```dns
# FORBIDDEN: CNAME + A
mail.example.com.   IN  CNAME    server1.example.com.
mail.example.com.   IN  A        192.168.1.20

# FORBIDDEN: CNAME + MX
example.com.        IN  CNAME    hosting.provider.com.
example.com.        IN  MX       10 mail.example.com.

# FORBIDDEN: CNAME + TXT
api.example.com.    IN  CNAME    app-server.example.com.
api.example.com.    IN  TXT      "v=spf1 include:_spf.example.com ~all"
```

#### ✅ Solution:
```dns
# Use multiple A/AAAA instead of CNAME
mail.example.com.   IN  A        192.168.1.20
mail.example.com.   IN  A        192.168.1.21

# Or point to an intermediate name
api.example.com.    IN  A        203.0.113.10
api.example.com.    IN  TXT      "v=spf1 include:_spf.example.com ~all"
_api-backend        IN  CNAME    app-server.example.com.
```

---

### Rule #2: MX and NS NEVER Point to CNAMEs

**RFC 2181 Section 10.3:** MX and NS records must point to names with A/AAAA records.

#### ❌ FORBIDDEN:
```dns
example.com.        IN  MX       10 mail.example.com.
mail.example.com.   IN  CNAME    mailserver.hosting.com.

example.com.        IN  NS       ns1.example.com.
ns1.example.com.    IN  CNAME    nameserver.provider.com.
```

#### ✅ CORRECT:
```dns
example.com.        IN  MX       10 mail.example.com.
mail.example.com.   IN  A        192.168.1.50
mail.example.com.   IN  AAAA     2001:db8::50

example.com.        IN  NS       ns1.example.com.
ns1.example.com.    IN  A        192.168.1.53
ns1.example.com.    IN  AAAA     2001:db8::53
```

---

### Rule #3: No CNAME Chains

**RFC 1034/2181:** Avoid CNAMEs pointing to other CNAMEs.

#### ⚠️ DISCOURAGED:
```dns
www.example.com.    IN  CNAME    web.example.com.
web.example.com.    IN  CNAME    server.example.com.
server.example.com. IN  A        192.168.1.100
```
**Problem:** 3 DNS queries instead of 1, increased latency, timeout risk.

#### ✅ OPTIMIZED:
```dns
www.example.com.    IN  CNAME    server.example.com.
web.example.com.    IN  CNAME    server.example.com.
server.example.com. IN  A        192.168.1.100
```

---

### Rule #4: TTL Consistency

**Principle:** Multiple A/AAAA records for the same name must have the **same TTL**.

#### ❌ INCONSISTENT:
```dns
www.example.com.    300   IN  A     192.168.1.10
www.example.com.    3600  IN  A     192.168.1.11
```

#### ✅ CONSISTENT:
```dns
www.example.com.    300   IN  A     192.168.1.10
www.example.com.    300   IN  A     192.168.1.11
```

**Special case: Multiple views (Internal & External)**

⚠️ **Critical attention:** A same record exposed in multiple views **MUST** have the same TTL.

#### ❌ CONFIGURATION ERROR:
```dns
# EXTERNAL View
www.example.com.    300   IN  A     203.0.113.10    # ext

# INTERNAL View - ⚠️ DIFFERENT TTL (common error)
www.example.com.    3600  IN  A     203.0.113.10    # int
```

**Problem**: Internal and external clients will have different caching behaviors for the **same resource**.

#### ✅ CORRECT CONFIGURATION:
```dns
# EXTERNAL View
www.example.com.    300   IN  A     203.0.113.10    # ext

# INTERNAL View - IDENTICAL TTL
www.example.com.    300   IN  A     203.0.113.10    # int
```

**Why this matters**:
- 🔄 DNS cache consistency across views
- 📊 Predictable behavior during failovers
- 🐛 Easier debugging (same TTL = same behavior)
- ⚡ Prevents desynchronization during migrations

**Legitimate use case** (different IPs per view):
```dns
# EXTERNAL View - Public IP
app.example.com.    300   IN  A     203.0.113.20    # ext

# INTERNAL View - Private IP, SAME TTL
app.example.com.    300   IN  A     192.168.1.20    # int
```

**TTL Recommendations:**
- **SOA/NS:** 86400 (24h) - Stable infrastructure
- **MX:** 3600 (1h) - Allows quick changes
- **A/AAAA (Production):** 300-3600 (5min-1h)
- **A/AAAA (Failover):** 60-300 (1-5min)
- **CNAME:** Aligned with target
- **TXT (SPF/DKIM):** 3600 (1h)

---

### Rule #5: No DNS Loops

**Absolutely avoid:**
```dns
# FORBIDDEN: Direct loop
a.example.com.      IN  CNAME    a.example.com.

# FORBIDDEN: Indirect loop
a.example.com.      IN  CNAME    b.example.com.
b.example.com.      IN  CNAME    a.example.com.
```

---

### Rule #6: DNS View Segregation (RFC 1918)

**RFC 1918 Section 3:** Private IP addresses must **NEVER** be exposed publicly.

#### ❌ CRITICAL VIOLATION:
```dns
# EXTERNAL View (Public) - ⚠️ INFORMATION LEAK
api.example.com.    IN  A        192.168.1.50    # ext  ❌ Private IP exposed
db.example.com.     IN  A        10.0.5.100      # ext  ❌ Private IP exposed
admin.example.com.  IN  A        172.16.0.10     # ext  ❌ Private IP exposed
```

**Problems:**
- Reveals internal network architecture
- Facilitates targeted attacks
- Exposes private addressing scheme
- RFC 1918 Section 3 violation

#### ✅ CORRECT CONFIGURATION:
```dns
# EXTERNAL View (Public) - Only public IPs
api.example.com.    IN  A        203.0.113.50    # ext  ✅ Public IP

# INTERNAL View (Private) - Private IPs allowed
api.example.com.    IN  A        192.168.1.50    # int  ✅ Private IP
db.example.com.     IN  A        10.0.5.100      # int  ✅ Private IP
admin.example.com.  IN  A        172.16.0.10     # int  ✅ Private IP
```

#### RFC 1918 Ranges to Protect:

| Range | CIDR | Typical Usage |
|-------|------|---------------|
| `10.0.0.0 - 10.255.255.255` | `10.0.0.0/8` | Large enterprises |
| `172.16.0.0 - 172.31.255.255` | `172.16.0.0/12` | Medium enterprises |
| `192.168.0.0 - 192.168.255.255` | `192.168.0.0/16` | Small business, SOHO |
| `127.0.0.0 - 127.255.255.255` | `127.0.0.0/8` | Loopback (localhost) |
| `169.254.0.0 - 169.254.255.255` | `169.254.0.0/16` | Link-local (APIPA) |
| `fc00::/7` | IPv6 ULA | IPv6 private |
| `fe80::/10` | IPv6 Link-local | IPv6 local |

#### Best Practices:

✅ **Public IPs** can be in **any view**:
```dns
# ✅ ALLOWED: Public IP internally (direct LAN access)
www.example.com.    IN  A        203.0.113.10    # int

# ✅ ALLOWED: Public IP externally (internet access)
www.example.com.    IN  A        203.0.113.10    # ext

# ✅ ALLOWED: Public IP in both views
www.example.com.    IN  A        203.0.113.10    # int,ext
```

❌ **Private IPs** must remain **internal only**:
```dns
# ❌ FORBIDDEN: Private IP exposed publicly
db.example.com.     IN  A        192.168.1.100   # ext

# ✅ CORRECT: Private IP internal only
db.example.com.     IN  A        192.168.1.100   # int
```

---

## 🏗️ Recommended Architecture

### Pattern #1: Load Balancing with Multiple A Records

```dns
# Good for load distribution and redundancy
www.example.com.    300   IN  A     192.168.1.10
www.example.com.    300   IN  A     192.168.1.11
www.example.com.    300   IN  A     192.168.1.12
```

**Advantages:**
- Automatic DNS round-robin
- High availability
- No CNAME = can coexist with TXT

---

### Pattern #2: Multiple Aliases to Single Infrastructure

```dns
# Main infrastructure
server.example.com.     300   IN  A     203.0.113.10
server.example.com.     300   IN  AAAA  2001:db8::10

# Application aliases
www.example.com.        300   IN  CNAME  server.example.com.
app.example.com.        300   IN  CNAME  server.example.com.
api.example.com.        300   IN  CNAME  server.example.com.
```

**Advantages:**
- Single IP change
- Simplified maintenance
- Easier migration

---

### Pattern #3: Zone Apex (Domain Root)

**Problem:** The domain root cannot have a CNAME (RFC 1912).

```dns
# ❌ FORBIDDEN
example.com.        IN  CNAME    hosting.provider.com.

# ✅ SOLUTIONS
# Solution A: Direct A/AAAA
example.com.        IN  A        203.0.113.10
example.com.        IN  AAAA     2001:db8::10

# Solution B: ALIAS/ANAME (CloudFlare, Route53, etc.)
example.com.        IN  ALIAS    server.example.com.

# Solution C: www redirection
example.com.        IN  A        203.0.113.10
www.example.com.    IN  CNAME    server.example.com.
```

---

### Pattern #4: Email Services (MX)

```dns
# Zone apex with MX
example.com.        IN  MX       10 mail1.example.com.
example.com.        IN  MX       20 mail2.example.com.

# Mail servers with A/AAAA (NEVER CNAME)
mail1.example.com.  IN  A        203.0.113.20
mail1.example.com.  IN  AAAA     2001:db8::20
mail2.example.com.  IN  A        203.0.113.21
mail2.example.com.  IN  AAAA     2001:db8::21

# SPF on main domain
example.com.        IN  TXT      "v=spf1 mx include:_spf.example.com ~all"

# DKIM on selector
selector1._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=MIGfMA0..."

# DMARC
_dmarc.example.com. IN  TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
```

---

### Pattern #5: Multiple DNS Views (Internal & External)

```dns
# EXTERNAL View (Public)
www.example.com.    IN  A        203.0.113.10   # Public IP (🟢)

# INTERNAL View (Private)
www.example.com.    IN  A        192.168.1.10   # Private IP (🔵)
```

**⚠️ Important:**
- Always document views in metadata
- **NEVER expose RFC 1918 IPs in external view**
- Validate with `dns2mermaid.js` to detect leaks
- 🔵 Blue = Internal only
- 🟢 Green = External only
- 🟣 Purple = Internal & External

**Legitimate use cases:**

```dns
# ✅ Internal & external with public IP (🟣)
app.example.com.    IN  A        203.0.113.20    # int,ext  ✅ OK

# ✅ Internal only with private IP (🔵)
db.example.com.     IN  A        192.168.1.50    # int      ✅ OK

# ❌ External with private IP - VIOLATION (⚠️)
api.example.com.    IN  A        10.0.0.100      # ext      ❌ RFC 1918 LEAK
```

---

## 📋 Validation Checklist

### Before Deployment:

- [ ] **No CNAME with other types** on same name
- [ ] **MX/NS point to A/AAAA** (never CNAME)
- [ ] **No CNAME chains** (max 1 level)
- [ ] **Consistent TTLs** for multiple A/AAAA
- [ ] **No DNS loops**
- [ ] **Zone apex has A/AAAA** (no CNAME)
- [ ] **Wildcards limited** (avoid on NS/MX/SOA)
- [ ] **IPv4 AND IPv6** for critical services
- [ ] **Views documented** (internal/external)
- [ ] **No RFC 1918 IPs in external view** (RFC 1918 validation)

### Recommended Tests:

```bash
# Verify resolution
dig +short www.example.com A
dig +short www.example.com AAAA

# Verify MX
dig +short example.com MX

# Trace CNAME chain
dig +trace www.example.com

# Check TTL
dig www.example.com | grep "^www"

# DNSSEC validation
dig +dnssec example.com
```

---

## 🎨 Naming Conventions

### Recommended Prefixes:

```dns
# Infrastructure
ns1.example.com.     # Nameserver 1
mail.example.com.    # Mail server
smtp.example.com.    # SMTP relay

# Applications
www.example.com.     # Web site
api.example.com.     # REST API
app.example.com.     # Web application

# Services
ftp.example.com.     # FTP
vpn.example.com.     # VPN
db.example.com.      # Database (INTERNAL ONLY)

# Environments
dev.example.com.     # Development
staging.example.com. # Pre-production
prod.example.com.    # Production

# Metadata
_spf.example.com.              # SPF delegation
_dmarc.example.com.            # DMARC
selector._domainkey.example.com. # DKIM
_acme-challenge.example.com.   # Let's Encrypt
```

---

## 🔒 DNS Security

### DNSSEC (Domain Name System Security Extensions)

```dns
# Enable DNSSEC for integrity
example.com.        IN  DNSKEY   257 3 8 (public key)
example.com.        IN  DS       12345 8 2 (hash)
```

### CAA (Certification Authority Authorization)

```dns
# Restrict authorized CAs
example.com.        IN  CAA      0 issue "letsencrypt.org"
example.com.        IN  CAA      0 issuewild "letsencrypt.org"
example.com.        IN  CAA      0 iodef "mailto:security@example.com"
```

### SPF, DKIM, DMARC (Email)

```dns
# SPF: Authorize email servers
example.com.        IN  TXT      "v=spf1 mx ip4:203.0.113.0/24 ~all"

# DKIM: Email signing
selector1._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=..."

# DMARC: Authentication policy
_dmarc.example.com. IN  TXT      "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
```

---

## 📊 Organization by Service Type

### Standard Web Site:

```dns
example.com.        300   IN  A        203.0.113.10
example.com.        300   IN  AAAA     2001:db8::10
www.example.com.    300   IN  CNAME    example.com.
```

### High Availability Web Site:

```dns
www.example.com.    60    IN  A        203.0.113.10
www.example.com.    60    IN  A        203.0.113.11
www.example.com.    60    IN  A        203.0.113.12
```

### Multi-Component Application:

```dns
# Frontend
app.example.com.    300   IN  CNAME    frontend.example.com.
frontend.example.com. 300 IN  A        203.0.113.20

# API Backend
api.example.com.    300   IN  CNAME    backend.example.com.
backend.example.com. 300  IN  A        203.0.113.30
backend.example.com. 300  IN  A        203.0.113.31

# CDN Assets
cdn.example.com.    3600  IN  CNAME    cdn-provider.example.net.
```

### Complete Email Infrastructure:

```dns
# MX Records
example.com.        IN  MX       10 mail1.example.com.
example.com.        IN  MX       20 mail2.example.com.

# Servers
mail1.example.com.  IN  A        203.0.113.50
mail2.example.com.  IN  A        203.0.113.51

# Autodiscover (Exchange/Office365)
autodiscover.example.com. IN CNAME autodiscover.outlook.com.

# SPF
example.com.        IN  TXT      "v=spf1 mx include:_spf.google.com ~all"

# DKIM
google._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=..."

# DMARC
_dmarc.example.com. IN  TXT      "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@example.com"
```

---

## 🔄 Migration Management

### Server Migration Without Downtime:

```dns
# STEP 1: Initial state
www.example.com.    300   IN  A        192.168.1.10  # Old server

# STEP 2: Reduce TTL (24h before)
www.example.com.    60    IN  A        192.168.1.10

# STEP 3: Add new server
www.example.com.    60    IN  A        192.168.1.10  # Old
www.example.com.    60    IN  A        192.168.1.20  # New

# STEP 4: Remove old (after validation)
www.example.com.    60    IN  A        192.168.1.20

# STEP 5: Restore normal TTL
www.example.com.    300   IN  A        192.168.1.20
```

### Provider Migration:

```dns
# Use CNAME to intermediate infrastructure
www.example.com.    300   IN  CNAME    lb.example.com.
lb.example.com.     60    IN  A        203.0.113.10  # Quick change point
```

---

## 📈 Monitoring and Alerts

### Metrics to Monitor:

1. **DNS response time** (< 50ms ideal)
2. **NXDOMAIN request rate** (< 5%)
3. **Internal/external view consistency**
4. **DNSSEC certificate expiration**
5. **SPF/DKIM/DMARC validity**

### Recommended Tools:

```bash
# Continuous validation
dnsviz analyze example.com
intodns.com example.com
mxtoolbox.com

# Monitoring
zonemaster-cli example.com
dnssec-analyzer example.com
```

---

## 🚨 Top 10 Common Errors to Avoid

1. **CNAME on zone apex** (example.com)
2. **MX pointing to CNAME**
3. **Forgetting IPv6** (AAAA)
4. **TTL too long** during migrations
5. **Multiple CNAME** levels
6. **CNAME + other types** on same name
7. **NS without glue records** (missing A/AAAA)
8. **SPF too permissive** (`+all` instead of `~all`)
9. **Wildcards on critical types** (MX, NS)
10. **Private RFC 1918 IPs exposed in external view** (information leak)

---

## 📚 RFC References

- **RFC 1034:** Domain Names - Concepts and Facilities
- **RFC 1035:** Domain Names - Implementation and Specification
- **RFC 1912:** Common DNS Operational and Configuration Errors
- **RFC 1918:** Address Allocation for Private Internets (Private IPs)
- **RFC 2181:** Clarifications to the DNS Specification
- **RFC 4034:** DNSSEC Resource Records
- **RFC 7208:** SPF (Sender Policy Framework)
- **RFC 6376:** DKIM (DomainKeys Identified Mail)
- **RFC 7489:** DMARC (Domain-based Message Authentication)
