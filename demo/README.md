# DNS2Mermaid - Demo Case Study

Simple DNS infrastructure of a fictional company **ACME Corporation** with a few common errors for demonstration.

## Content

**Source file**: `demo_complete.csv` (11 DNS records)

**Infrastructure**:
- Domain: `acme-corp.com` 
- Services: www, blog, mail, api, ns1
- Multi-view: Internal (10.0.x.x) / External (198.51.100.x)
- Email: SPF + DMARC configured

**Intentional errors** (for demonstration):
- ⚠️ **CNAME_CHAIN**: `blog` → `www` → `acme-corp.com` (2 levels)
- ⚠️ **INCONSISTENT_TTL**: `api.acme-corp.com` has different TTLs across views (3600 vs 86400)

## Generation

```bash
# Complete command with all validations
node dns2mermaid.js -i demo/demo_complete.csv --compact-layout --svg demo/demo.svg
# Note: SSL and HTTP/HTTPS validations enabled by default (40 simultaneous checks)
# To disable: --no-ssl-check --no-http-check
# Enriched CSV report generated automatically
```

**Result**: `demo.mmd` (Mermaid diagram) + `demo.svg` (image) + `legend.svg` (legend) + `validation_report.txt` (RFC + SSL + HTTP report) + `analysis_report.csv` (enriched report)
