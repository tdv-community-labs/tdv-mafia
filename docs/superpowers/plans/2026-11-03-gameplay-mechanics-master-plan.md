# TDV Mafia — Oyun Mexanizminin İnkişafı üzrə Teamwork Master Planı

> **Agent komandaları (Teamwork) üçün:** TÖVSİYƏ EDİLƏN ALT-BACARIQ: `superpowers:subagent-driven-development` və ya `superpowers:executing-plans`. Tapşırıqlar yoxlama qutuları (`- [ ]`) ilə addım-addım izlənilir.

**Hədəf:** TDV Mafia platformasının oyun mexanizmlərini (Gecə hərəkətləri matrisi, Məhkəmə və Müdafiə kürsüsü mərhələsi, asimmetrik mini-oyunların tam interaktivliyi, kontekstual AI bot dialoqları və immersiv döyüş masası UI) qabaqcıl səviyyəyə çatdırmaq.

**Arxitektura:** Layihə asılılıqları təcrid olunmuş 5 paralel iş axınına (Workstream) bölünür. Hər bir iş axını təmiz TypeScript tipləri, deterministik mühərrik funksiyaları, reaktiv UI komponentləri və avtomatlaşdırılmış test dəstləri ilə təchiz olunur.

**Texnoloji Yığın:** Next.js 14 (App Router), TypeScript 5.7, Tailwind CSS, Framer Motion, Web Audio SFX Engine, @google/genai (Gemini 3.8 Flash), tsx test runner.

---

## 🎯 İş Axınları və Tapşırıqlar (Workstreams)

### 🔹 İş Axını 1: Qabaqcıl Gecə Fəaliyyətləri Matrisi & Xüsusiyyət Mexanikaları (Engine Specialist)
- [ ] **Tapşırıq 1.1:** Bədənkeşikçisi (Bodyguard) və Qisas (Retaliation) Mexanizmi
- [ ] **Tapşırıq 1.2:** Xüsusiyyətlərin (`IRON_WILL`, `PHANTOM_STEP`, `NIGHT_VISION`) Gecə Fəaliyyətinə Təsiri

### 🔹 İş Axını 2: Məhkəmə, Müdafiə Kürsüsü & Təkrar Səsvermə (Social Deduction Specialist)
- [ ] **Tapşırıq 2.1:** Müdafiə Kürsüsü (Podium Defense) Fazası (`TRIAL_DEFENSE`)
- [ ] **Tapşırıq 2.2:** Bələdiyyə Sədri (Mayor) Açıqlaması və Çəkili Səslər

### 🔹 İş Axını 3: Asimmetrik Mini-oyunların İnteraktivliyi & Yeni Formatlar (Minigames Specialist)
- [ ] **Tapşırıq 3.1:** Stanford Prison Tam İnteraktiv İdarəetməsi (`PRISON_SANCTION`, `PRISON_SOLITARY`)
- [ ] **Tapşırıq 3.2:** Çernobıl Qadağan Zonası (Chernobyl Exclusion Zone) Mühərriki

### 🔹 İş Axını 4: AI Bot Dialoqları & Sosial Deduksiya Alqoritmləri (AI Specialist)
- [ ] **Tapşırıq 4.1:** Kontekstual Bot Dialoq Generatoru (Gündüz çatı replikaları)
- [ ] **Tapşırıq 4.2:** Mafiya və Xəfiyyə Bot Taktika İntellekti (Anti-friendly fire)

### 🔹 İş Axını 5: İmmersiv Döyüş Masası HUD, Kürsü İşıqlandırması & SFX (UI/UX Specialist)
- [ ] **Tapşırıq 5.1:** Kürsü İşıqlandırması (Spotlight) & Müdafiə Taymeri
- [ ] **Tapşırıq 5.2:** Gecə Hədəfi Təsdiq Nişanları və Mini-oyun HUD-u
