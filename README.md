# BigQuery Release Pulse ⚡

A premium, modern web dashboard for tracking real-time Google Cloud BigQuery platform updates. Built using a Python Flask backend and a plain vanilla HTML5/CSS3/JS frontend featuring a sleek, responsive glassmorphic user interface.

![Aesthetic Dashboard Preview](https://img.shields.io/badge/Aesthetics-Glassmorphism-blueviolet?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Flask%20%7C%20VanillaJS%20%7C%20CSS3-blue?style=for-the-badge)
![Cache Status](https://img.shields.io/badge/Feature-In--Memory%20Cache-emerald?style=for-the-badge)

---

## ✨ Features

* **Live Feed Parser & Segmenter**: Parses the official Google Cloud BigQuery RSS feed and segments daily release logs into individual update cards categorized by category types (`Feature`, `Announcement`, `Issue`, `Deprecation`).
* **5-Minute Performance Cache**: Features an in-memory cache system to load the dashboard in milliseconds, reducing request latency to Google's RSS servers. Includes a manual force-reload query bypass (`?force=true`) and automated connection-error fallbacks.
* **Instant Client-Side Filters**: Instant, real-time keywords search and category filter tags running in the browser without full page reloads.
* **Twitter (X) Shortener-Aware Share Composer**: An interactive, customized modal that lets you edit your update details, checks character counts, automatically accounts for Twitter's 23-character `t.co` link shortener, and opens a Web Intent in a new browser tab.
* **Premium Glassmorphic Aesthetics**: Built using a modern dark design theme, custom category badge color styles, background glowing meshes, scroll transitions, and shimmer skeletons during initial loads.

---

## 📂 Project Structure

```
bq-releases-notes/
├── .venv/                      # Python virtual environment
├── requirements.txt            # Dependency file (Flask, requests, bs4)
├── app.py                      # Flask backend, XML parser, & caching controller
├── .gitignore                  # Git untracked pattern definitions
├── README.md                   # Project documentation
├── templates/
│   └── index.html              # Main HTML skeletal view & Twitter modal
└── static/
    ├── css/
    │   └── style.css           # Glassmorphic style declarations & animations
    └── js/
        └── app.js              # Client state controller, search engine, & toast handlers
```

---

## 🚀 Quick Start & Installation

### Prerequisites
* Python 3.10 or higher installed on your system.
* Git installed.

### Setup and Running Local Server
1. **Clone the repository or navigate to the directory**:
   ```bash
   cd bq-releases-notes
   ```

2. **Initialize Python Virtual Environment**:
   ```bash
   python -m venv .venv
   ```

3. **Activate the Virtual Environment**:
   * **Windows (PowerShell)**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   * **Linux/macOS**:
     ```bash
     source .venv/bin/activate
     ```

4. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the Application**:
   ```bash
   python app.py
   ```

6. **Open Dashboard**:
   Open your browser and navigate to **`http://127.0.0.1:5000`**.

---

## 🛠️ Architecture Deep Dive

### Server-Side (`app.py`)
* **XML Traversal**: Parses XML using standard namespaces (`{atom: "http://www.w3.org/2005/Atom"}`).
* **BeautifulSoup Segmentation**: Feeds the HTML string from the feed element into BeautifulSoup. Identifies `<h3>` tags (headers) and traverses forward through sibling elements (paragraphs, code segments, list tags) until it hits the next header tag or the end of the markup. This breaks a daily digest down into individual, modular update cards.
* **Resilience Fallback**: If an on-demand refresh fails due to an external GCP network timeout, Flask returns the last successfully cached copy with a warning status, keeping the service operational.

### Client-Side (`app.js`)
* **Live In-Memory Filtering**: Runs multi-criterion filters over the JSON payload across descriptions, categories, and date headings instantly.
* **X (Twitter) Shortener Calculations**: Computes character counts factoring in shortened links:
  $$\text{Length} = \text{Text without URL}.length + 23$$
  Warns the user when remaining characters drop below 30 and disables posting if characters exceed the 280-character limit.
* **Direct Link Actions**: Extracts direct target anchors for specific release dates and copies them directly to the user's clipboard, firing a toast alert on completion.

---

## 📝 License
This project is licensed under the MIT License.
