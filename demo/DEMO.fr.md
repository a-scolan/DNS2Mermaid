# 🔍 DNS2Mermaid - Demo

> **DNS Infrastructure Visualization & RFC Validation**

A command-line tool that transforms your DNS records into clear visual diagrams while automatically detecting RFC non-compliance and configuration issues.

---

## 🎯 Main Features

| Feature | Description |
|---------|-------------|
| 📊 **Visualization** | Generates professional Mermaid and SVG diagrams of your DNS infrastructure |
| ✅ **RFC Validation** | Automatically detects 19 types of RFC violations and best practices |
| 🔒 **SSL Certificates** | Verifies SSL/TLS certificates and alerts on expirations (40 simultaneous checks) |
| 🌐 **HTTP/HTTPS** | Tests domain availability with status codes (HTTPS:200, HTTP:404, etc.) |
| 🌐 **Multi-View** | Supports Internal/External views with color coding |
| 📧 **Email** | Automatically groups DMARC, DKIM, SPF records |
| ⚡ **Compact** | Optimized layout mode for large infrastructures |

---

## 📋 Demo Case Study

DNS infrastructure of **ACME Corporation** with a few intentional common errors to demonstrate detection capabilities.

### 📊 Statistics

```
🌐 Domains analyzed       : 7
📝 DNS records           : 11
🔢 IP addresses         : 5
⚠️  WARNING violations   : 2
ℹ️  INFO recommendations : 4
```

### ⚠️ Detected Violations

#### 1. 🔗 CNAME_CHAIN (WARNING)

**Domain**: `blog.acme-corp.com`

**Problem**: 2-level CNAME chain
```
blog.acme-corp.com → www.acme-corp.com → acme-corp.com
```

**Impact**: CNAME chains degrade performance and increase resolution times.

**Reference**: 📖 RFC 2181 Section 10.1

---

#### 2. ⏱️ INCONSISTENT_TTL (WARNING)

**Domain**: `api.acme-corp.com`

**Problem**: Inconsistent TTLs between views
```
External View: 3600s (1 hour)
Internal View: 86400s (24 hours)
```

**Impact**: Inconsistent TTLs cause unpredictable cache behavior across views.

**Reference**: 📖 RFC 1035 Section 3.2.1

---

#### 3. 🌐 MISSING_IPV6 (INFO)

**Affected domains**: 4 domains

**Problem**: A records without corresponding AAAA (IPv6)

**Recommendation**: Support IPv6 for infrastructure modernization.

**Reference**: 📖 RFC 8200 (IPv6 Specification)

---

## 🎨 Generated Diagram

![ACME Corporation DNS Diagram](demo.svg)

<details>
<summary>📖 Symbol Legend</summary>

![Legend](legend.svg)

</details>

---

## 💻 Installation & Usage

### Installation

```bash
# Clone repository
git clone https://github.com/a-scolan/DNS2Mermaid.git
cd DNS2Mermaid

# Install dependencies
npm install
```

### Demo Generation

```bash
# Quick command
npm run demo

# Or complete command with all validations
node dns2mermaid.js -i demo/demo_complete.csv \
  --compact-layout \
  --svg demo.svg \
  --background white
# Note: SSL and HTTP/HTTPS enabled by default
```

### Results

Generated files in `demo/`:
- ✅ `demo.svg` - Visual diagram
- ✅ `demo.mmd` - Mermaid source
- ✅ `legend.svg` - Symbol legend
- ✅ `validation_report.txt` - Detailed violation report

---

## 📝 Source CSV File

```csv
TTL,Name,Type,Value,View
3600,acme-corp.com,A,198.51.100.10,ext
3600,acme-corp.com,MX,10 mail.acme-corp.com,ext
3600,acme-corp.com,NS,ns1.acme-corp.com,ext
3600,acme-corp.com,TXT,"v=spf1 mx ip4:198.51.100.0/24 -all",ext
3600,www.acme-corp.com,CNAME,acme-corp.com,ext
3600,blog.acme-corp.com,CNAME,www.acme-corp.com,ext
3600,mail.acme-corp.com,A,198.51.100.20,ext
3600,ns1.acme-corp.com,A,198.51.100.30,ext
3600,api.acme-corp.com,A,198.51.100.40,ext
86400,api.acme-corp.com,A,10.0.1.40,int
3600,_dmarc.acme-corp.com,TXT,"v=DMARC1; p=quarantine; rua=mailto:dmarc@acme-corp.com",ext
```

---

## 🚀 Advanced Features

### Command-line Options

```bash
# Compact mode for large infrastructures
--compact-layout

# SSL/TLS and email validation
--email-validation

# Ignore certain rules
--ignore-rules MISSING_IPV6,TTL_TOO_SHORT

# Ignore SSL timeouts
--ssl-no-timeout-errors

# Output format
--svg output.svg --background white

# Report only (CI/CD mode)
--no-diagram -r validation_report.txt
```

### Multi-View (Internal/External)

DNS2Mermaid automatically distinguishes views:
- 🔵 **Internal**: RFC 1918 private addresses
- 🟢 **External**: Public addresses
- 🟣 **Both**: Present in both views

---

## 📚 Validation Types

### 🚨 CRITICAL (Blocking)
- `CNAME_COEXISTENCE` - CNAME cannot coexist with other types
- `CNAME_ON_APEX` - CNAME forbidden on zone apex
- `CNAME_LOOP` - CNAME pointing to itself
- `MX_TO_CNAME` / `NS_TO_CNAME` - MX/NS to CNAME forbidden
- `SPF_TOO_PERMISSIVE` - SPF with +all is dangerous

### ⚠️ WARNING (Important)
- `CNAME_CHAIN` - CNAME chains degrade performance
- `INCONSISTENT_TTL` - Inconsistent TTLs
- `TTL_TOO_SHORT` - TTL < 60s causes excessive load
- `MX_ORPHAN` / `NS_ORPHAN` - Points to unresolved name

### ℹ️ INFO (Recommendations)
- `MISSING_IPV6` - Lack of IPv6
- `TTL_TOO_LONG` - TTL > 24h slows down changes
- `WILDCARD_RESTRICTION` - Wildcards with certain types
- `DUPLICATE_RECORD` - Redundant records
- `CNAME_ORPHAN` - CNAME to external domain

---

## 🎓 Validation Report

The complete validation report is available in the file [`validation_report.txt`](./validation_report.txt).

### Report Excerpt

```
═══════════════════════════════════════════════════════════
           DNS RFC VALIDATION REPORT
              & SSL/TLS CERTIFICATES
═══════════════════════════════════════════════════════════

Date: 2025-12-11T16:48:53.192Z
Source file: demo/demo_complete.csv
Analyzed domains: 7
Violations detected: 6

SSL/TLS CERTIFICATES VERIFIED: 6
🟢 OK (>21d): 1
⚠️  WARNING (7-21d): 0
🚨 CRITICAL (<7d): 0
❌ ERRORS: 4

🚨 Blocking Violations (CRITICAL): 0
⚠️  Issues to Fix (WARNING): 2
ℹ️  Best Practices (INFO): 4

📊 SUMMARY BY RULE:

   ℹ️ MISSING_IPV6: 4 violation(s)
   ⚠️ CNAME_CHAIN: 1 violation(s)
   ⚠️ INCONSISTENT_TTL: 1 violation(s)

───────────────────────────────────────────────────────────


⚠️  ISSUES TO FIX QUICKLY:

1. [CNAME_CHAIN] blog.acme-corp.com
   CNAME points to another CNAME (www.acme-corp.com -> acme-corp.com)
   Reference: RFC 2181 Section 10.1 (Performance)
   Affected records: CNAME www.acme-corp.com

2. [INCONSISTENT_TTL] api.acme-corp.com
   Inconsistent TTLs for A/AAAA records (3600, 86400)
   Reference: RFC 1035 Section 3.2.1 (DNS Cache)
   Affected records: A 198.51.100.40, A 10.0.1.40


ℹ️  RECOMMENDATIONS (BEST PRACTICES):

1. [MISSING_IPV6] acme-corp.com
   A record without corresponding AAAA (best practice: support IPv6)
   Reference: Best practice: RFC 8200 (IPv6 Specification)
   Affected records: A 198.51.100.10

2. [MISSING_IPV6] mail.acme-corp.com
   A record without corresponding AAAA (best practice: support IPv6)
   Reference: Best practice: RFC 8200 (IPv6 Specification)
   Affected records: A 198.51.100.20

3. [MISSING_IPV6] ns1.acme-corp.com
   A record without corresponding AAAA (best practice: support IPv6)
   Reference: Best practice: RFC 8200 (IPv6 Specification)
   Affected records: A 198.51.100.30

4. [MISSING_IPV6] api.acme-corp.com
   A record without corresponding AAAA (best practice: support IPv6)
   Reference: Best practice: RFC 8200 (IPv6 Specification)
   Affected records: A 198.51.100.40, A 10.0.1.40

───────────────────────────────────────────────────────────
```

📄 **[View complete report](./validation_report.txt)** (180 lines, includes SSL/TLS details and all validated rules)

---

## 📊 Enriched CSV Report

The file [`analysis_report.csv`](./analysis_report.csv) contains all DNS records with added analysis columns.

### Data Preview

| Name | Type | Value | Violations | SSL_Status | HTTPS_Status | IP_Type | Is_Orphan |
|------|------|-------|------------|------------|--------------|---------|-----------|
| acme-corp.com | A | 198.51.100.10 | MISSING_IPV6 | Valid | 200 | IPv4 | No |
| acme-corp.com | MX | 10 mail.acme-corp.com | - | Valid | 200 | - | No |
| www.acme-corp.com | CNAME | acme-corp.com | - | Valid | 200 | - | No |
| blog.acme-corp.com | CNAME | www.acme-corp.com | CNAME_CHAIN | Valid | 200 | - | No |
| api.acme-corp.com | A | 198.51.100.40 | MISSING_IPV6;INCONSISTENT_TTL | Valid | Error: Timeout | IPv4 | No |
| api.acme-corp.com | A | 10.0.1.40 | MISSING_IPV6;INCONSISTENT_TTL | Valid | Error: Timeout | IPv4 (Private RFC1918) | No |

**21 columns total** including:
- **Original columns**: TTL, Name, Type, Value, View
- **DNS Violations**: Violations, Violation_Severity, Violation_Count
- **SSL/TLS**: SSL_Status, SSL_Expiry_Days, SSL_Issuer
- **HTTP/HTTPS**: HTTP_Status, HTTPS_Status, HTTP_Response_Time, HTTPS_Response_Time
- **IP Analysis**: IP_Type, IP_Count, View_Type
- **Resolution**: Is_Orphan, Points_To, Resolved_IPs

📊 **Use cases**: Excel analysis with pivot tables, Python/Pandas scripts, Power BI/Tableau dashboards, DNS configuration time-series tracking.

---

## 🔗 Useful Links

- 📖 [Complete Documentation](../README.md)
- 🐛 [Report a Bug](https://github.com/a-scolan/DNS2Mermaid/issues)
- 💡 [Request Feature](https://github.com/a-scolan/DNS2Mermaid/issues/new)
- 📦 [Releases](https://github.com/a-scolan/DNS2Mermaid/releases)

---

## 📄 License

AGPL-3.0 License - Powered by Node.js & Mermaid

**Version**: 1.1.0
