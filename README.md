# Melody Incipit Grid Tool

**A reusable tool primitive for encoding melody.**

The Melody Incipit Grid Tool represents a melody through four aligned musical primitives: **chords, counts, scale degrees, and lyrics or syllables**.

Its core operation is simple:

> **Convert a melody into structured, reusable musical data.**

That representation can then support song learning, transcription, practice, analysis, teaching, songwriting, corpus building, and future tools across the Creativity Engine.

**Live tool:**  
https://danielleackerman.github.io/melody-incipit-tool/

**Chaos Portal:**  
https://danielleackerman.github.io/chaos-portal/

## 🎼 What This Primitive Does

This is not only a melody worksheet or practice aid. It is a self-contained creative primitive: a focused tool that performs one foundational operation well and produces output that can be reused elsewhere.

The tool separates a melody into distinct layers while preserving their relationship on a shared rhythmic grid.

| Musical primitive | What it represents | What it makes visible |
|---|---|---|
| **Chords** | Harmonic context | The harmony supporting each bar |
| **Counts** | Beat and subdivision placement | Exactly when each event occurs |
| **Scale degrees** | Pitch function relative to the key | The contour and interval logic of the melody |
| **Lyrics / syllables** | Language attached to each note | Where words, syllables, and stresses land |

Because every layer shares the same grid, the result is not a loose collection of notes. It is a stable melody representation that can be read by a person, exported into other formats, stored in a corpus, or connected to larger creative systems.

## ✨ What Makes It Different

Most melody tools privilege one representation at a time. Notation shows pitch and rhythm. A recording preserves sound. A chord sheet shows harmony. Lyrics preserve language.

The Melody Incipit Grid Tool keeps these layers distinct **and** synchronized.

- **Grid logic without spreadsheet feel:** the structure is exact, but the interface is made of musical bar cards rather than rows and columns.
- **Relative pitch instead of staff notation:** scale degrees reveal melodic function and allow the same phrase to be understood across keys.
- **Human-readable and machine-usable:** one structured entry generates an aligned reading view plus Markdown, JSON, and plain-text output.
- **Primitive-first architecture:** the tool performs one focused operation that can stand alone or become part of a larger workflow.

## 🎯 What You Can Use It For

| Use | What the primitive contributes |
|---|---|
| **Learn a song** | Makes harmony, rhythm, pitch, and lyrics visible together |
| **Practice a difficult phrase** | Shows exactly where notes and syllables fall without requiring full notation |
| **Transcribe by ear** | Provides a fast relative-pitch framework for recording what you hear |
| **Analyze melodies** | Makes hooks, motifs, contours, cadences, and repeated patterns easier to compare |
| **Write songs** | Preserves melody as structured material that can be revised and developed |
| **Teach or collaborate** | Gives singers and musicians a shared, readable map of the phrase |
| **Build a corpus** | Produces consistent melody data that can be searched, compared, and reused later |

## 🧭 How to Use It

1. Choose the phrase you want to map: a hook, opening, motif, vocal run, difficult passage, or complete melodic section.
2. Enter the musical context, including key, mode, meter, tempo, feel, tags, and an optional audio reference.
3. Choose the rhythmic grid: quarter notes, eighth notes, or sixteenth notes.
4. Enter the chord for each bar.
5. Place scale degrees and lyric syllables into their rhythmic positions.
6. Review the aligned result in Read Mode.
7. Export it for practice, study, comparison, archiving, or future tool use.

## 🧩 Reading the Grid

Each bar is read vertically. The chord establishes the harmonic context, the counts establish time, and the degree and lyric lanes place musical and verbal events into that shared structure.

```text
Chords:  | C                         | F                         |
Counts:  | 1   &   2   &   3   &   4   & | 1   &   2   &   3   &   4   & |
Degrees: | 3       3   2   1       5     | 4       3   2   1             |
Lyrics:  | I       was walk- ing   home  | call-   ing Your name          |
```

The tool manages spacing automatically, so the primitives remain aligned even when syllables or chord names vary in length.

### Scale-degree entry

- `1`–`7` represent degrees of the key
- `b3` renders as `♭3`
- `#4` renders as `♯4`
- `-` can mark a held note
- An empty cell can represent space or rest

Using scale degrees makes melodic function visible and allows the phrase to be studied independently of one fixed key.

## 🎹 Capture Mode and Read Mode

| Mode | Purpose |
|---|---|
| **Capture Mode** | Build and revise the melody using bar cards, phrases, subdivisions, and keyboard entry |
| **Read Mode** | View the completed melody map as a clean study, practice, teaching, or print reference |

Capture Mode supports adding, duplicating, clearing, deleting, and reordering bars; creating multiple phrases; changing rhythmic resolution; and watching the aligned preview update as you work.

## 💾 Saving and Exporting

The current melody is saved automatically in the browser.

For a durable copy, export it in the format that matches the next use:

| Format | Best for |
|---|---|
| **Markdown** | Obsidian, study notes, human-readable archives, and corpus documents |
| **JSON** | Reopening the complete structured melody and connecting to future tools |
| **Plain text** | Quick copying, sharing, printing, and practice references |

Browser storage can be cleared, so JSON export is the safest long-term backup.

## 🌱 Part of a Larger Primitive System

The Melody Incipit Grid Tool is designed as one primitive within a broader creative ecosystem.

Its output can eventually support:

- Searchable libraries of melody incipits
- Song-learning collections
- Melody comparison and pattern analysis
- Creativity Engine corpus material
- Connections to the All Song App
- Chord, rhythm, scale-degree, and motif tools
- Launching and discovery through the Chaos Portal

Keeping the primitive independent allows it to remain useful on its own while also making it easier to connect, compose, and reuse inside larger systems.

## 🔗 Chaos Portal

The tool is part of the wider project ecosystem available through the Chaos Portal:

https://danielleackerman.github.io/chaos-portal/

The Melody Incipit Grid Tool remains independently deployed so it can be developed and reused without being locked inside the portal repository.

## 🛠️ Run Locally

This is a static HTML, CSS, and JavaScript application with no build step or external dependencies.

```bash
cd /path/to/melody-incipit-tool
python3 -m http.server 8080
open http://localhost:8080/
```

If port `8080` is already in use:

```bash
python3 -m http.server 8081
open http://localhost:8081/
```

## ✅ Current Version

**Version 0.1.0 — first complete functional release**
