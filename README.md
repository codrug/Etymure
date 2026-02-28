# etym*ure*

**Etymure** is an immersive, AI-powered spatial etymology explorer. It transforms word discovery into a visual journey, mapping the history, meaning, and literary impact of language across an infinite digital canvas.

---

## ✨ Key Features

- **Infinite Spatial Canvas**: Explore words as interconnected clusters in a fluid, draggable workspace.
- **Multi-Dimensional Insight**:
  - **Etymology**: Trace roots back to Ancient Greek, Latin, Proto-Indo-European, and beyond.
  - **Historical Timeline**: Visualize semantic shifts and milestones through the centuries.
  - **Literary References**: Discover evocative quotes from classic and contemporary literature.
  - **Related Concepts**: Explore thematic cousins, synonyms, and antonyms to expand your vocabulary.
- **AI-Powered Discovery**: Driven by the **Google Gemini API**, providing scholarly yet engaging content in real-time.
- **Context-Aware Imagery**: Every card is paired with thematic visuals that reflect the specific word and its history.
- **Robust Exploration**: Use the **Random** button to discover rare vocabulary or the **Test** button for instant demonstrations.

## Getting Started

### Prerequisites
- A modern web browser.
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/codrug/Etymure.git
   ```
2. Create a `.env` file in the root directory and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Start a local server (e.g., using Python):
   ```bash
   python -m http.server 8000
   ```
4. Open your browser and navigate to:
   `http://localhost:8000/Endless%20Canvas%20Navigation%20Sample.html`

---

## Tech Stack

- **Frontend**: React (v18), ReactDOM
- **Styling**: Custom CSS3 with hardware-accelerated animations
- **AI Engine**: Google Gemini API (1.5 Flash, 2.0 Flash, 3.0 Flash fallback system)
- **Imagery**: Dynamic sourcing via Unsplash and LoremFlickr

---

## Navigation Tips

- **Search**: Type any word in the header to create a new cluster.
- **Pan**: Right-click and drag to move across the infinite canvas.
- **Zoom**: Use the scroll wheel or the floating controls to dive into details.
- **Organize**: Drag the handle at the top of any card to reposition it. Overlaps are resolved automatically via force repulsion!

---

*“Words are the small visible part of a gigantic invisible architecture.”*
