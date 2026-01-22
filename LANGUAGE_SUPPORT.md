# Language Support for Generated Reports

## Summary

DNS2Mermaid now supports bilingual report generation with **English as the default language** and **French available via a language parameter**.

## Changes Made

### 1. Help Text Updated
- Added documentation for `--language` and `--lang` parameters to help output
- Location: [dns2mermaid.js](dns2mermaid.js#L53)
- Shows available options: `'en'` (default) or `'fr'`

### 2. Language Parameter Added
- **Parameter Options:**
  - `--language en` (explicit English)
  - `--language fr` (French)
  - `--lang en|fr` (alias for --language)
  - Default: `en` (English)
- Location: [dns2mermaid.js](dns2mermaid.js#L160-L161)

### 3. Translation System Implemented
- **TRANSLATIONS Object** created with complete bilingual strings
- **Helper Function** `t(key)` for easy translation lookups
- **Fallback Logic:** If French translation missing, uses English
- Location: [dns2mermaid.js](dns2mermaid.js#L164-L252)

### 4. Report Generation Translated
Generated reports now support both languages:

#### Validation Report (validation_report.txt)
- **Title:** "DNS RFC VALIDATION REPORT" (EN) / "RAPPORT DE VALIDATION DNS RFC" (FR)
- **Headers:** Date, Source file, Domains analyzed, Violations detected
- **Sections:** SSL/TLS Status, HTTP/HTTPS Availability, Rule Summary
- **Violations:** Critical, Warning, Info sections with full translations
- **Rule Descriptions:** All 19 DNS rules + 10 email validation rules (when enabled)

#### CSV Report (analysis_report.csv)
- CSV column headers still in their technical format
- Data content uses language parameter

## Usage Examples

### Default (English)
```bash
# These produce English reports
node dns2mermaid.js -i zones.csv
node dns2mermaid.js -i zones.csv --language en
node dns2mermaid.js -i zones.csv --lang en
```

### French
```bash
# These produce French reports
node dns2mermaid.js -i zones.csv --language fr
node dns2mermaid.js -i zones.csv --lang fr
```

## Translation Coverage

### Fully Translated
✅ Validation report headers and structure
✅ Rule summary sections  
✅ Violation details (Critical, Warning, Info)
✅ SSL/TLS certificate status reporting
✅ HTTP/HTTPS availability status
✅ All 29 rule descriptions (19 DNS + 10 Email)
✅ Error messages in reports

### Partially Translated (Pending)
⏳ Console log messages (still in French in some cases)
⏳ Progress indicators during execution
⏳ Help text (mixed French/English)

### Not Translated (By Design)
- Technical terminology (RFC references, DNS record types, etc.)
- CSV data column headers (remain technical)
- Code and comments (remain in French for codebase consistency)

## Technical Details

### Translation Keys (Partial List)
- `report_title`: Report header
- `date`, `source_file`, `domains_analyzed`: Metadata labels
- `violations_critical`, `violations_warning`, `violations_info`: Violation counts
- `rule_summary`: Rules by violation type
- `cname_coexistence`, `mx_to_cname`, etc.: Individual rule descriptions
- `ssl_section`, `http_section`: Section headers
- And 50+ more keys for complete coverage

### Language Parameter Parsing
```javascript
const LANGUAGE = getArg('--language', getArg('--lang', 'en')).toLowerCase();
const LANG = LANGUAGE === 'fr' ? 'fr' : 'en'; // Forces binary choice
```

## Testing

### Verified Tests
✅ Default English report generation
✅ French report with `--language fr`
✅ French report with `--lang fr`
✅ Report accuracy with violations (critical, warning, info)
✅ SSL/TLS section translations
✅ HTTP/HTTPS section translations
✅ All rule descriptions in both languages
✅ Fallback to English when translation missing

## File Modifications

**Only one file modified:**
- `dns2mermaid.js` (3,529 lines)
  - Lines 53-54: Help text
  - Lines 160-161: Language parameter parsing
  - Lines 164-252: TRANSLATIONS object and helper function
  - Lines 2740-2945: Report generation with translations

## Backwards Compatibility

✅ **100% Backwards Compatible**
- Existing scripts without language parameter work unchanged (English output)
- No breaking changes to CSV input format
- No changes to diagram generation logic
- No changes to validation rules or logic

## Future Improvements

Potential enhancements (not in current release):
- Translate console log messages (info, progress, errors)
- Add more languages (Spanish, German, etc.)
- Create separate translation files for easier maintenance
- Support language parameter in batch mode
- Add language detection from environment variables

## Examples with Output

### English Report (Default)
```
═══════════════════════════════════════════════════════════
           DNS RFC VALIDATION REPORT
═══════════════════════════════════════════════════════════

Date: 2026-01-22T09:40:33.039Z
Source file: 04_critical_spf_too_permissive.csv
Domains analyzed: 1
Violations detected: 2

🚨 BLOCKING VIOLATIONS (CRITICAL): 1
⚠️  ISSUES TO FIX (WARNING): 0
ℹ️  BEST PRACTICES (INFO): 1
```

### French Report (With --language fr)
```
═══════════════════════════════════════════════════════════
           RAPPORT DE VALIDATION DNS RFC
═══════════════════════════════════════════════════════════

Date: 2026-01-22T09:40:56.913Z
Fichier source: 04_critical_spf_too_permissive.csv
Domaines analysés: 1
Violations détectées: 2

🚨 Violations BLOQUANTES (CRITICAL): 1
⚠️  Problèmes à corriger (WARNING): 0
ℹ️  Bonnes pratiques (INFO): 1
```

---

**Last Updated:** January 22, 2026
**Language Support Version:** 1.0
