# 📖 Guide des Bonnes Pratiques DNS

**Version:** 1.0  
**Date:** 2024  
**Objectif:** Gérer sainement un ensemble de domaines, sous-domaines et services sans conflits

---
## ✅ Résumé Exécutif

### Les 5 Règles d'Or:

1. **Un CNAME = Seul de son type** (jamais avec A, MX, TXT, etc.)
2. **MX/NS pointent vers A/AAAA** (jamais CNAME)
3. **Pas de chaînes CNAME** (1 niveau maximum)
4. **TTL cohérents** pour enregistrements similaires
5. **Ségrégation des vues DNS** (RFC 1918 : IP privées uniquement en interne)

### Workflow de Validation:

1. Conception → Vérifier patterns recommandés
2. Configuration → Valider syntaxe et règles RFC
3. Test → dig, nslookup, validation online
4. Déploiement → Réduire TTL avant changements
5. Monitoring → Surveiller métriques et alertes
6. Documentation → Mettre à jour schémas et notes

---

## 🎯 Principes Fondamentaux

### 1. Un Type par Nom (La Règle d'Or)
**Principe RFC 1034/1035:**  
Un nom DNS ne peut avoir qu'**UN SEUL TYPE** d'enregistrement principal.

❌ **INTERDIT:**
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

## 🚫 Règles RFC Strictes à Respecter

### Règle #1: CNAME est Exclusif
Un enregistrement **CNAME** ne peut **JAMAIS** coexister avec d'autres types.

#### ❌ Violations Courantes:
```dns
# INTERDIT: CNAME + A
mail.example.com.   IN  CNAME    server1.example.com.
mail.example.com.   IN  A        192.168.1.20

# INTERDIT: CNAME + MX
example.com.        IN  CNAME    hosting.provider.com.
example.com.        IN  MX       10 mail.example.com.

# INTERDIT: CNAME + TXT
api.example.com.    IN  CNAME    app-server.example.com.
api.example.com.    IN  TXT      "v=spf1 include:_spf.example.com ~all"
```

#### ✅ Solution:
```dns
# Utiliser des A/AAAA multiples au lieu de CNAME
mail.example.com.   IN  A        192.168.1.20
mail.example.com.   IN  A        192.168.1.21

# Ou pointer vers un nom intermédiaire
api.example.com.    IN  A        203.0.113.10
api.example.com.    IN  TXT      "v=spf1 include:_spf.example.com ~all"
_api-backend        IN  CNAME    app-server.example.com.
```

---

### Règle #2: MX et NS ne Pointent JAMAIS vers des CNAME

**RFC 2181 Section 10.3:** Les enregistrements MX et NS doivent pointer vers des noms ayant des enregistrements A/AAAA.

#### ❌ INTERDIT:
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

### Règle #3: Pas de Chaînes CNAME

**RFC 1034/2181:** Éviter les CNAMEs pointant vers d'autres CNAMEs.

#### ⚠️ DÉCONSEILLÉ:
```dns
www.example.com.    IN  CNAME    web.example.com.
web.example.com.    IN  CNAME    server.example.com.
server.example.com. IN  A        192.168.1.100
```
**Problème:** 3 requêtes DNS au lieu d'1, latence accrue, risque de timeout.

#### ✅ OPTIMISÉ:
```dns
www.example.com.    IN  CNAME    server.example.com.
web.example.com.    IN  CNAME    server.example.com.
server.example.com. IN  A        192.168.1.100
```

---

### Règle #4: Cohérence des TTL

**Principe:** Les enregistrements A/AAAA multiples pour un même nom doivent avoir le **même TTL**.

#### ❌ INCOHÉRENT:
```dns
www.example.com.    300   IN  A     192.168.1.10
www.example.com.    3600  IN  A     192.168.1.11
```

#### ✅ COHÉRENT:
```dns
www.example.com.    300   IN  A     192.168.1.10
www.example.com.    300   IN  A     192.168.1.11
```

**Cas spécial : Vues multiples (Interne & Externe)**

⚠️ **Attention critique** : Un même enregistrement exposé dans plusieurs vues **DOIT** avoir le même TTL.

#### ❌ ERREUR DE CONFIGURATION:
```dns
# Vue EXTERNE
www.example.com.    300   IN  A     203.0.113.10    # ext

# Vue INTERNE - ⚠️ TTL DIFFÉRENT (erreur courante)
www.example.com.    3600  IN  A     203.0.113.10    # int
```

**Problème** : Les clients internes et externes auront des comportements de cache différents pour la **même ressource**.

#### ✅ CONFIGURATION CORRECTE:
```dns
# Vue EXTERNE
www.example.com.    300   IN  A     203.0.113.10    # ext

# Vue INTERNE - TTL IDENTIQUE
www.example.com.    300   IN  A     203.0.113.10    # int
```

**Pourquoi c'est important** :
- 🔄 Cohérence du cache DNS entre vues
- 📊 Comportement prévisible lors des basculements
- 🐛 Facilite le débogage (même TTL = même comportement)
- ⚡ Évite les désynchronisations lors des migrations

**Cas d'usage légitime** (IP différentes selon vue) :
```dns
# Vue EXTERNE - IP publique
app.example.com.    300   IN  A     203.0.113.20    # ext

# Vue INTERNE - IP privée, MÊME TTL
app.example.com.    300   IN  A     192.168.1.20    # int
```

**Recommandations TTL:**
- **SOA/NS:** 86400 (24h) - Infrastructure stable
- **MX:** 3600 (1h) - Permet changements rapides
- **A/AAAA (Production):** 300-3600 (5min-1h)
- **A/AAAA (Failover):** 60-300 (1-5min)
- **CNAME:** Aligné sur la cible
- **TXT (SPF/DKIM):** 3600 (1h)

---

### Règle #5: Pas de Boucles DNS

**Éviter absolument:**
```dns
# INTERDIT: Boucle directe
a.example.com.      IN  CNAME    a.example.com.

# INTERDIT: Boucle indirecte
a.example.com.      IN  CNAME    b.example.com.
b.example.com.      IN  CNAME    a.example.com.
```

---

### Règle #6: Ségrégation des Vues DNS (RFC 1918)

**RFC 1918 Section 3:** Les adresses IP privées ne doivent **JAMAIS** être exposées publiquement.

#### ❌ VIOLATION CRITIQUE:
```dns
# Vue EXTERNE (Publique) - ⚠️ FUITE D'INFORMATION
api.example.com.    IN  A        192.168.1.50    # ext  ❌ IP privée exposée
db.example.com.     IN  A        10.0.5.100      # ext  ❌ IP privée exposée
admin.example.com.  IN  A        172.16.0.10     # ext  ❌ IP privée exposée
```

**Problèmes:**
- Révèle l'architecture réseau interne
- Facilite les attaques ciblées
- Expose le plan d'adressage privé
- Violation RFC 1918 Section 3

#### ✅ CONFIGURATION CORRECTE:
```dns
# Vue EXTERNE (Publique) - Uniquement IPs publiques
api.example.com.    IN  A        203.0.113.50    # ext  ✅ IP publique

# Vue INTERNE (Privée) - IPs privées autorisées
api.example.com.    IN  A        192.168.1.50    # int  ✅ IP privée interne
db.example.com.     IN  A        10.0.5.100      # int  ✅ IP privée interne
admin.example.com.  IN  A        172.16.0.10     # int  ✅ IP privée interne
```

#### Plages RFC 1918 à Protéger:

| Plage | CIDR | Usage Typique |
|-------|------|---------------|
| `10.0.0.0 - 10.255.255.255` | `10.0.0.0/8` | Grandes entreprises |
| `172.16.0.0 - 172.31.255.255` | `172.16.0.0/12` | Moyennes entreprises |
| `192.168.0.0 - 192.168.255.255` | `192.168.0.0/16` | Petites entreprises, SOHO |
| `127.0.0.0 - 127.255.255.255` | `127.0.0.0/8` | Loopback (localhost) |
| `169.254.0.0 - 169.254.255.255` | `169.254.0.0/16` | Link-local (APIPA) |
| `fc00::/7` | IPv6 ULA | IPv6 privé |
| `fe80::/10` | IPv6 Link-local | IPv6 local |

#### Bonnes Pratiques:

✅ **IP publiques** peuvent être dans **n'importe quelle vue** :
```dns
# ✅ AUTORISÉ : IP publique en interne (accès direct depuis LAN)
www.example.com.    IN  A        203.0.113.10    # int

# ✅ AUTORISÉ : IP publique en externe (accès internet)
www.example.com.    IN  A        203.0.113.10    # ext

# ✅ AUTORISÉ : IP publique dans les deux vues
www.example.com.    IN  A        203.0.113.10    # int,ext
```

❌ **IP privées** doivent rester **uniquement en interne** :
```dns
# ❌ INTERDIT : IP privée exposée publiquement
db.example.com.     IN  A        192.168.1.100   # ext

# ✅ CORRECT : IP privée uniquement en interne
db.example.com.     IN  A        192.168.1.100   # int
```

---

## 🏗️ Architecture Recommandée

### Pattern #1: Load Balancing avec A Multiples

```dns
# Bon pour la répartition de charge et la redondance
www.example.com.    300   IN  A     192.168.1.10
www.example.com.    300   IN  A     192.168.1.11
www.example.com.    300   IN  A     192.168.1.12
```

**Avantages:**
- Round-robin DNS automatique
- Haute disponibilité
- Pas de CNAME = peut coexister avec TXT

---

### Pattern #2: Alias Multiples vers Infrastructure Unique

```dns
# Infrastructure principale
server.example.com.     300   IN  A     203.0.113.10
server.example.com.     300   IN  AAAA  2001:db8::10

# Alias applicatifs
www.example.com.        300   IN  CNAME  server.example.com.
app.example.com.        300   IN  CNAME  server.example.com.
api.example.com.        300   IN  CNAME  server.example.com.
```

**Avantages:**
- Changement d'IP unique
- Maintenance simplifiée
- Migration facilitée

---

### Pattern #3: Zone Apex (Racine du Domaine)

**Problème:** La racine d'un domaine ne peut PAS avoir de CNAME (RFC 1912).

```dns
# ❌ INTERDIT
example.com.        IN  CNAME    hosting.provider.com.

# ✅ SOLUTIONS
# Solution A: A/AAAA directs
example.com.        IN  A        203.0.113.10
example.com.        IN  AAAA     2001:db8::10

# Solution B: ALIAS/ANAME (CloudFlare, Route53, etc.)
example.com.        IN  ALIAS    server.example.com.

# Solution C: www redirection
example.com.        IN  A        203.0.113.10
www.example.com.    IN  CNAME    server.example.com.
```

---

### Pattern #4: Services Email (MX)

```dns
# Zone Apex avec MX
example.com.        IN  MX       10 mail1.example.com.
example.com.        IN  MX       20 mail2.example.com.

# Serveurs mail avec A/AAAA (JAMAIS CNAME)
mail1.example.com.  IN  A        203.0.113.20
mail1.example.com.  IN  AAAA     2001:db8::20
mail2.example.com.  IN  A        203.0.113.21
mail2.example.com.  IN  AAAA     2001:db8::21

# SPF sur le domaine principal
example.com.        IN  TXT      "v=spf1 mx include:_spf.example.com ~all"

# DKIM sur sélecteur
selector1._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=MIGfMA0..."

# DMARC
_dmarc.example.com. IN  TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
```

---

### Pattern #5: Vues DNS Multiples (Interne & Externe)

```dns
# Vue EXTERNE (Publique)
www.example.com.    IN  A        203.0.113.10   # IP publique (🟢)

# Vue INTERNE (Privée)
www.example.com.    IN  A        192.168.1.10   # IP privée (🔵)
```

**⚠️ Important:** 
- Toujours documenter les vues dans les métadonnées
- **JAMAIS exposer d'IP RFC 1918 en vue externe**
- Valider avec `dns2mermaid.js` pour détecter les fuites
- 🔵 Bleu = Interne uniquement
- 🟢 Vert = Externe uniquement
- 🟣 Violet = Interne & Externe

**Cas d'usage légitimes:**

```dns
# ✅ Configuration interne & externe avec IP publique (🟣)
app.example.com.    IN  A        203.0.113.20    # int,ext  ✅ OK

# ✅ Service interne uniquement avec IP privée (🔵)
db.example.com.     IN  A        192.168.1.50    # int      ✅ OK

# ❌ Service externe avec IP privée - VIOLATION (⚠️)
api.example.com.    IN  A        10.0.0.100      # ext      ❌ FUITE RFC 1918
```

---

## 📋 Checklist de Validation

### Avant Déploiement:

- [ ] **Pas de CNAME avec autres types** sur le même nom
- [ ] **MX/NS pointent vers A/AAAA** (jamais CNAME)
- [ ] **Pas de chaînes CNAME** (max 1 niveau)
- [ ] **TTL cohérents** pour A/AAAA multiples
- [ ] **Pas de boucles DNS**
- [ ] **Zone apex a A/AAAA** (pas CNAME)
- [ ] **Wildcards limités** (éviter sur NS/MX/SOA)
- [ ] **IPv4 ET IPv6** pour les services critiques
- [ ] **Documentation des vues** (interne/externe)
- [ ] **Aucune IP RFC 1918 en vue externe** (validation RFC 1918)

### Tests Recommandés:

```bash
# Vérifier la résolution
dig +short www.example.com A
dig +short www.example.com AAAA

# Vérifier les MX
dig +short example.com MX

# Tracer la chaîne CNAME
dig +trace www.example.com

# Vérifier le TTL
dig www.example.com | grep "^www"

# Validation DNSSEC
dig +dnssec example.com
```

---

## 🎨 Conventions de Nommage

### Préfixes Recommandés:

```dns
# Infrastructure
ns1.example.com.     # Nameserver 1
mail.example.com.    # Mail server
smtp.example.com.    # SMTP relay

# Applications
www.example.com.     # Site web
api.example.com.     # API REST
app.example.com.     # Application web

# Services
ftp.example.com.     # FTP
vpn.example.com.     # VPN
db.example.com.      # Database (INTERNE UNIQUEMENT)

# Environnements
dev.example.com.     # Développement
staging.example.com. # Pré-production
prod.example.com.    # Production

# Métadonnées
_spf.example.com.              # Délégation SPF
_dmarc.example.com.            # DMARC
selector._domainkey.example.com. # DKIM
_acme-challenge.example.com.   # Let's Encrypt
```

---

## 🔒 Sécurité DNS

### DNSSEC (Domain Name System Security Extensions)

```dns
# Activer DNSSEC pour l'intégrité
example.com.        IN  DNSKEY   257 3 8 (clé publique)
example.com.        IN  DS       12345 8 2 (hash)
```

### CAA (Certification Authority Authorization)

```dns
# Restreindre les CA autorisées
example.com.        IN  CAA      0 issue "letsencrypt.org"
example.com.        IN  CAA      0 issuewild "letsencrypt.org"
example.com.        IN  CAA      0 iodef "mailto:security@example.com"
```

### SPF, DKIM, DMARC (Email)

```dns
# SPF: Autoriser serveurs email
example.com.        IN  TXT      "v=spf1 mx ip4:203.0.113.0/24 ~all"

# DKIM: Signature des emails
selector1._domainkey.example.com. IN TXT "v=DKIM1; k=rsa; p=..."

# DMARC: Politique de validation
_dmarc.example.com. IN  TXT      "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
```

---

## 📊 Organisation par Type de Service

### Site Web Standard:

```dns
example.com.        300   IN  A        203.0.113.10
example.com.        300   IN  AAAA     2001:db8::10
www.example.com.    300   IN  CNAME    example.com.
```

### Site Web Haute Disponibilité:

```dns
www.example.com.    60    IN  A        203.0.113.10
www.example.com.    60    IN  A        203.0.113.11
www.example.com.    60    IN  A        203.0.113.12
```

### Application Multi-Composants:

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

### Infrastructure Email Complète:

```dns
# MX Records
example.com.        IN  MX       10 mail1.example.com.
example.com.        IN  MX       20 mail2.example.com.

# Serveurs
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

## 🔄 Gestion des Migrations

### Migration Serveur sans Interruption:

```dns
# ÉTAPE 1: État initial
www.example.com.    300   IN  A        192.168.1.10  # Ancien serveur

# ÉTAPE 2: Réduire le TTL (24h avant)
www.example.com.    60    IN  A        192.168.1.10

# ÉTAPE 3: Ajouter nouveau serveur
www.example.com.    60    IN  A        192.168.1.10  # Ancien
www.example.com.    60    IN  A        192.168.1.20  # Nouveau

# ÉTAPE 4: Retirer ancien (après validation)
www.example.com.    60    IN  A        192.168.1.20

# ÉTAPE 5: Restaurer TTL normal
www.example.com.    300   IN  A        192.168.1.20
```

### Migration Fournisseur:

```dns
# Utiliser CNAME vers infrastructure intermédiaire
www.example.com.    300   IN  CNAME    lb.example.com.
lb.example.com.     60    IN  A        203.0.113.10  # Modifiable rapidement
```

---

## 📈 Monitoring et Alertes

### Métriques à Surveiller:

1. **Temps de réponse DNS** (< 50ms idéal)
2. **Taux de requêtes NXDOMAIN** (< 5%)
3. **Cohérence vue interne/externe**
4. **Expiration des certificats DNSSEC**
5. **Validité SPF/DKIM/DMARC**

### Outils Recommandés:

```bash
# Validation continue
dnsviz analyze example.com
intodns.com example.com
mxtoolbox.com

# Monitoring
zonemaster-cli example.com
dnssec-analyzer example.com
```

---

## 🚨 Erreurs Courantes à Éviter

### ❌ Top 10 des Erreurs:

1. **CNAME sur zone apex** (example.com)
2. **MX pointant vers CNAME**
3. **Oublier les IPv6** (AAAA)
4. **TTL trop long** lors de migrations
5. **Chaînes CNAME** multiples
6. **CNAME + autres types** sur même nom
7. **NS sans glue records** (A/AAAA manquants)
8. **SPF trop permissif** (`+all` au lieu de `~all`)
9. **Wildcards sur types critiques** (MX, NS)
10. **IP privées RFC 1918 exposées en vue externe** (fuite d'information)

---

## 📚 Références RFC

- **RFC 1034:** Domain Names - Concepts and Facilities
- **RFC 1035:** Domain Names - Implementation and Specification
- **RFC 1912:** Common DNS Operational and Configuration Errors
- **RFC 1918:** Address Allocation for Private Internets (IP privées)
- **RFC 2181:** Clarifications to the DNS Specification
- **RFC 4034:** DNSSEC Resource Records
- **RFC 7208:** SPF (Sender Policy Framework)
- **RFC 6376:** DKIM (DomainKeys Identified Mail)
- **RFC 7489:** DMARC (Domain-based Message Authentication)
