# Azkar TV Display — Rev08 (v3.0)

A production-grade Islamic reference and display app for **Android TV / Google TV** (built
for the **Panasonic TH-65MX740M**) that also runs on **Android phones and tablets**. It
shows a Salah timeline and a single, spacious content card that rotates through an
authentic, deduplicated library of **Dua** and **Azkar**. Works fully offline; the internet
is used only to auto-detect your location for prayer times.

## Content architecture

Two master types only — **Dua** and **Azkar** — stored as four offline JSON files in
`app/src/main/assets/content/`:

- `dua.json` — Dua items only
- `azkar.json` — Azkar items only (Kalimas live here under the *Kalima* category — there is
  no separate Kalima type)
- `categories.json` — category display metadata (label, icon, colour theme, order)
- `content_index.json` — usage sections and the **rotation modes** that drive the app

Every entry carries: `id, type, title, arabic, tajweed_html, transliteration, translation,
category, sub_category, source_reference, authenticity, usage_tags, repeat_count,
is_long_text` (plus `source_type` used for filtering and tajweed).

**Deduplication:** each unique Arabic text is stored once. Items appear in multiple sections
through `usage_tags` (e.g. Ayat al-Kursi is one entry tagged morning, evening, after_salah,
sleep, protection, ruqyah). The build validates that there are no duplicate Arabic texts and
no empty required fields.

**Authenticity:** `authentic` (Quran and the most widely accepted Sahih reports),
`has_reference` (a clear classical source), or `needs_review` (traditionally-compiled texts
such as the 3rd–6th Kalimas and the later Salawat forms — Fatih, Munjiyah, Tibbiyah). These
are shown with a small "needs review" badge.

## Rotation modes

Modes are generated automatically from `content_index.json` (not hardcoded): Mixed, Dua
only, Azkar only, Quranic Duas, Prophetic Duas, Morning, Evening, After Salah, Sleep, Wake
Up, Protection, Ruqyah, Istighfar, Darood & Salawat, Tasbih, Witr & Qunoot, and
**Favorites**. Adding tags or categories to the data adds/affects modes with no code change.

## Using it

- **Swipe left / right** (touch) or **◀ / ▶** (remote) — previous / next item.
- **Long-press** a card (touch) or **OK** (remote) — add/remove **favourite** (with a toast).
- **▲** (remote) — open the rotation-mode menu; long text scrolls first if it overflows.
- **Mode** button (top) — pick a rotation mode. **★** chip — jump to favourites.
- **🔍 Search** and **⚙ Settings** — top-right. Settings: rotation timer (1–5 min or custom
  seconds), four themes (Light, Dark, Green Islamic, Gold & Navy), independent Arabic /
  transliteration / translation font sizes, and toggles (auto-rotate, salah strip,
  transliteration, tajweed colours).

There are no Prev / Next / Pause buttons — navigation is swipe, the D-pad, and auto-rotation.

## Salah, alerts, tajweed, location

- Prayer times use the **Umm al-Qura** method, computed on-device, with a live countdown ring
  and a full-screen alert + chime at each prayer time.
- **Auto-location** by IP on start (cached for offline); prayer times follow the detected city.
- **Tajweed colouring** is applied only to Quranic entries (`source_type: quran`) using a
  heuristic engine, or to any entry that supplies a verified `tajweed_html`. It is an aid; for
  fully verified tajweed, populate `tajweed_html` per entry — the app uses it when present.

## Build / install / publish

Unchanged from earlier revisions:
1. Push this folder to a GitHub repo → the **Build APK** workflow produces `app-debug.apk`
   (Actions tab → download the `azkar-tv-display-apk` artifact).
2. Copy to USB, enable unknown sources on the TV, install with a file manager.
3. Set as screensaver: Settings → System → Screensaver → Azkar TV Display.
4. For Google Play, add signing secrets and run **Build Release (Play Store)** for a signed
   `.aab` (see the signing notes below).

`applicationId` is `com.ahmed.azkartv`. `versionCode 3`, `versionName 3.0`.

## Changelog — Rev08 (v3.0)

**Files changed:** `index.html`, `app.css`, `app.js`; content replaced with `dua.json`,
`azkar.json`, `categories.json`, `content_index.json` (old `duas.json`/`kalima.json` and the
old-schema `azkar.json` removed). Version bumped to 3.0.

**New content structure:** two master types (Dua, Azkar) on the new per-item schema; 108
deduplicated entries (65 Dua, 43 Azkar) across 18 categories and 74 usage sections; expanded
Quranic duas (2:201, 2:286, 3:8, 3:9, 3:16, 3:53, 7:23, 7:89, 10:85–86, 14:40–41, 17:24,
18:10, 20:114, 21:83, 21:87, 23:97–98, 25:74, 26:83–85, 28:24, 59:10, 66:8), prophets' duas,
Istikhara, Qunoot/Witr/Tahajjud, the major Istighfar forms, Darood Ibrahim and the Salawat
forms (Fatih/Munjiyah/Tibbiyah marked needs_review), full morning/evening/after-salah/sleep/
wake-up/protection/ruqyah collections, and the six Kalimas under Azkar.

**Deduplication method:** a normalised Arabic key (diacritics, tatweel, spaces and
punctuation stripped) guarantees each Arabic text exists once; reuse is via `usage_tags`. A
build-time validator checks for duplicate Arabic and empty required fields (currently zero).

**New filters / modes:** 17 rotation modes generated from `content_index.json`, including
Favorites; plus full-text search across title, translation, transliteration, Arabic, and
tags.

**TV display improvements:** simplified single card with maximised reading space; secondary
controls hidden by default; D-pad model (◀▶ change, ▲ modes, OK favourite, Back close);
dynamic Arabic fit and vertical scroll for long text; verified `tajweed_html` honoured when
present, heuristic limited to Quran.

**Mobile / tablet improvements:** reliable gestures via Pointer Events with a Touch fallback,
pointer capture, and movement thresholds; swipe left/right to change; long-press to favourite
with toast feedback; vertical scroll for long text; responsive layout.

**Removed:** the Kalima content *type*, and the Prev / Next / Pause buttons.

**Validation completed:** no duplicate Arabic, no empty Arabic/transliteration/translation/
source fields, no item without type/category/usage_tags, JSON parses, JS passes `node --check`,
all categories and modes surface in the UI, all content is searchable and usable in rotation.

## Notes

Arabic is from the Quran and the standard hadith collections with exact references where
possible; English meanings are original (not a copyrighted translation). Where a precise
grading is uncertain, the item is marked `needs_review` rather than given an invented grade.
