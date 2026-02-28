const { useState, useRef, useCallback, useEffect } = React;

// ── API Configuration ──────────────────────────────────────────────────────────
// NOTE: For a production app, use a backend proxy to keep your API key secure.
const API_CONFIG = {
  GEMINI_KEY: "", // Will be loaded from .env
  MODELS: ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"], // Fallback models
};

// ── Constants ──────────────────────────────────────────────────────────────────
const CCW = 330; const CW = 270; const TLW = 292; const RELW = 246;
const CCH = 450; const SETH = { etymology:340, timeline:370, literary:295, related:250 };
const PAD = 36;

const cw = t => t==="central"?CCW:t==="timeline"?TLW:t==="related"?RELW:CW;
const ch = t => t==="central"?CCH:(SETH[t]||320);

// ── Collision-free placement ───────────────────────────────────────────────────
const PREF = { etymology:205, timeline:268, literary:55, related:132 };

const MIN_DIST_FACTOR_MAX_DIM = 0.55;
const MIN_DIST_FACTOR_CARD_DIM = 0.5;
const MIN_DIST_PAD_FACTOR = 1.5;
const MAX_PLACEMENT_DIST = 3200;
const PLACEMENT_DIST_STEP = 55;
const PLACEMENT_DEGREE_STEP = 8;
const FALLBACK_PLACEMENT_OFFSET_X = 3400;

const INITIAL_ANCHOR_Y_OFFSET = 40;
const ANCHOR_DISTANCE = 1050;
const ANCHOR_PROBE_DIMENSION = 1120;
const ANCHOR_PROBE_OFFSET = 560;
const ANCHOR_OVERLAP_PAD = 0;
const FALLBACK_ANCHOR_OFFSET_X = 1500;
const ANCHOR_DEGREES = [0,60,300,120,240,180,30,330,90,270];

function boxOverlaps(a, b, pad=0) {
  return !(a.x+a.w+pad < b.x || a.x > b.x+b.w+pad || a.y+a.h+pad < b.y || a.y > b.y+b.h+pad);
}

function placeCard(ax, ay, w, h, placed, prefDeg) {
  const radBase = prefDeg * Math.PI / 180;
  for (let r=PLACEMENT_DIST_STEP; r<MAX_PLACEMENT_DIST; r+=PLACEMENT_DIST_STEP) {
    for (let d=0; d<360; d+=PLACEMENT_DEGREE_STEP) {
      const rad = radBase + (d % 2 === 0 ? d : -d) * Math.PI / 180;
      const x = ax + Math.cos(rad) * r - w/2;
      const y = ay + Math.sin(rad) * r - h/2;
      const rect = {x, y, w, h};
      if (!placed.some(p => boxOverlaps(rect, p, PAD))) return {x, y};
    }
  }
  return {x: ax + FALLBACK_PLACEMENT_OFFSET_X, y: ay};
}

function layoutCluster(ax, ay, cards, existingRects) {
  const placed = [
    ...existingRects,
    {x:ax-CCW/2, y:ay-CCH/2, w:CCW, h:CCH},
  ];
  const positions = {};
  cards.forEach(card => {
    const w=cw(card.type), h=ch(card.type);
    const pos = placeCard(ax, ay, w, h, placed, PREF[card.type]??0);
    positions[card.id] = pos;
    placed.push({x:pos.x, y:pos.y, w, h});
  });
  return {positions, usedRects:placed};
}

function chooseAnchor(parentWord, clusters, placedRects) {
  const vw=window.innerWidth, vh=window.innerHeight;
  if (!clusters.length) return {x:vw/2, y:vh/2+INITIAL_ANCHOR_Y_OFFSET};
  const parent = clusters.find(c=>c.word===parentWord)||clusters[clusters.length-1];
  for (const deg of ANCHOR_DEGREES) {
    const rad=deg*Math.PI/180, D=ANCHOR_DISTANCE;
    const ax=parent.anchor.x+Math.cos(rad)*D, ay=parent.anchor.y+Math.sin(rad)*D;
    const probe={x:ax-ANCHOR_PROBE_OFFSET, y:ay-ANCHOR_PROBE_OFFSET, w:ANCHOR_PROBE_DIMENSION, h:ANCHOR_PROBE_DIMENSION};
    if (!placedRects.some(r=>boxOverlaps(probe,r,ANCHOR_OVERLAP_PAD))) return {x:ax, y:ay};
  }
  return {x:parent.anchor.x+FALLBACK_ANCHOR_OFFSET_X, y:parent.anchor.y};
}

// ── Force repulsion: push overlapping cards apart after drag ──────────────────const FALLBACK_ANCHOR_OFFSET_X = 1500;

const OVERLAP_RESOLUTION_ITERATIONS = 8;
const OVERLAP_PUSH_FACTOR = 0.5;
const ARROW_LENGTH = 11;
const ARROW_ANGLE_OFFSET = 0.42;
const CENTRAL_CARD_Z_INDEX = 5;
const CENTRAL_CARD_SHADOW_ALPHA = 0.13;
const CENTRAL_CARD_BORDER_ALPHA = 0.2;
const CARD_HOVER_SHADOW_ALPHA = 0.13;
const CARD_HOVER_BORDER_ALPHA = 0.25;
const DRAGGING_CARD_SHADOW_ALPHA = 0.22;
const DRAGGING_CARD_BORDER_ALPHA = 0.35;
const DRAG_HANDLE_OPACITY_TRANSITION_DURATION = 0.15;
const DRAG_HANDLE_SHADOW_ALPHA = 0.1;
const PILL_ANIMATION_DELAY_FACTOR = 0.05;
const PILL_ANIMATION_INITIAL_X_OFFSET = -16;
const PILL_ANIMATION_INITIAL_SCALE = 0.9;
const DOT_ANIMATION_DELAY_FACTOR = 0.2;
const DOT_ANIMATION_SCALE = 0.7;
const DOT_ANIMATION_OPACITY = 0.2;
const TOAST_DISPLAY_DURATION = 5000;
const ZOOM_MAX = 2.5;
const ZOOM_MIN = 0.2;
const ZOOM_IN_FACTOR = 1.09;
const ZOOM_OUT_FACTOR = 0.92;
const RANDOM_WORDS = [
  "labyrinth", "serendipity", "effervescence", "petrichor", "solitude", 
  "ethereal", "wanderlust", "luminescence", "ephemeral", "quintessential",
  "nostalgia", "resilience", "sonder", "mellifluous", "susurrus",
  "ineffable", "aurora", "chatoyant", "demure", "halcyon",
  "incandescent", "languor", "panacea", "surreptitious", "vestige"
];
const CENTRAL_CARD_FONT_SIZE = 24;
const ETYM_CARD_FONT_SIZE = 18;
const TIMELINE_CARD_FONT_SIZE = 14;
const TIMELINE_CARD_TITLE_MARGIN_BOTTOM = 8;
const TIMELINE_ROW_GAP = 8;
const TIMELINE_ROW_MARGIN_BOTTOM = 8;
const TIMELINE_DATE_MIN_WIDTH = 48;
const RELATED_ROW_GAP = 7;
const RELATED_ROW_MARGIN_BOTTOM = 5;
const RELATED_CARD_PADDING_TOP = 14;
const CLBL_Y_OFFSET = -20;
const CLBL_ANIMATION_DURATION = 0.4;
const TOAST_BOTTOM_OFFSET = 24;
const TOAST_PADDING_Y = 9;
const TOAST_PADDING_X = 18;
const TOAST_ANIMATION_DURATION = 0.25;
const HINT_BOTTOM_OFFSET = 28;
const HINT_LEFT_OFFSET = 50;
const WORD_PANEL_LEFT_OFFSET = 16;
const WORD_PANEL_TOP_OFFSET = 68;
const WORD_PANEL_MAX_HEIGHT_OFFSET = 100;
const WORD_PILL_ANIMATION_DURATION = 0.3;
const PILL_LABEL_PADDING_Y = 5;
const PILL_LABEL_PADDING_LEFT = 13;
const PILL_DEL_MARGIN = 3;
const PILL_DEL_SIZE = 24;
const PILL_DEL_BORDER_LEFT_ALPHA = 0.22;
const PILL_DEL_HOVER_BACKGROUND_ALPHA = 0.08;
const PILL_LOADING_PADDING_Y = 5;
const PILL_LOADING_PADDING_X = 13;
const PILL_LOADING_GAP = 7;
const DOT_SIZE = 4;
const DOT_BORDER_RADIUS = 50;
const DOT_ANIMATION_DURATION = 1.2;
const HEADER_PADDING_Y = 12;
const HEADER_PADDING_X = 24;
const HEADER_GAP = 18;
const SEARCH_INPUT_PADDING_Y = 8;
const SEARCH_INPUT_PADDING_X_RIGHT = 38;
const SEARCH_INPUT_PADDING_X_LEFT = 13;
const SEARCH_INPUT_BORDER_ALPHA = 0.45;
const SEARCH_INPUT_BACKGROUND_ALPHA = 0.72;
const SEARCH_BUTTON_RIGHT_OFFSET = 9;
const ZOOM_CONTROLS_BOTTOM_OFFSET = 28;
const ZOOM_CONTROLS_RIGHT_OFFSET = 24;
const ZOOM_CONTROLS_GAP = 4;
const ZOOM_BUTTON_SIZE = 32;
const ZOOM_BUTTON_BORDER_ALPHA = 0.4;
const ZOOM_BUTTON_BACKGROUND_ALPHA = 0.9;
const ZOOM_BUTTON_SHADOW_ALPHA = 0.08;
const ZOOM_LEVEL_MARGIN_TOP = 2;
const CLEAR_BUTTON_PADDING_Y = 3;
const CLEAR_BUTTON_PADDING_X = 9;
const CLEAR_BUTTON_BORDER_ALPHA = 0.35;
const CARD_BORDER_ALPHA = 0.16;
const CARD_SHADOW_ALPHA = 0.08;
const DRAG_HANDLE_TOP_OFFSET = -11;
const DRAG_HANDLE_WIDTH = 34;
const DRAG_HANDLE_HEIGHT = 11;
const DRAG_HANDLE_BACKGROUND_ALPHA = 0.85;
const DRAG_HANDLE_SHADOW_OFFSET_Y = 1;
const DRAG_HANDLE_SHADOW_BLUR = 4;
const DRAG_HANDLE_SHADOW_COLOR_ALPHA = 0.1;
const CARD_IMAGE_HEIGHT_CENTRAL = 158;
const CARD_IMAGE_HEIGHT_ETYMOLOGY = 96;
const CARD_IMAGE_HEIGHT_TIMELINE = 88;
const CARD_IMAGE_HEIGHT_LITERARY = 88;
const CARD_BODY_PADDING_Y = 12;
const CARD_BODY_PADDING_X = 14;
const LABEL_MARGIN_BOTTOM = 4;
const SUB_MARGIN_BOTTOM = 6;
const CP_MARGIN_TOP = 7;
const CQUOTE_PADDING_LEFT = 10;
const CQUOTE_MARGIN_Y = 7;
const CMETA_MARGIN_TOP = 6;
const BADGE_PADDING_Y = 2;
const BADGE_PADDING_X = 6;
const BADGE_MARGIN_TOP = 7;
const CHIP_PADDING_Y = 3;
const CHIP_PADDING_X = 9;
const CHIP_MARGIN = 2;
const LINE_STROKE_WIDTH_DASHED = 1.5;
const LINE_STROKE_DASH_ARRAY = "5 5";
const LINE_STROKE_WIDTH_SOLID = 2;
const ARROW_HEAD_OFFSET = 24;
const CLBL_FONT_SIZE = 10;
const CLBL_ANIMATION_FADE_IN_DURATION = 0.4;
const TOAST_BORDER_ALPHA = 0.4;
const TOAST_SHADOW_ALPHA = 0.1;
const TOAST_FONT_SIZE = 12;
const TOAST_ANIMATION_FADE_IN_DURATION = 0.25;
const ROOT_BACKGROUND_IMAGE_SIZE = 26;
const HEADER_BACKGROUND_ALPHA = 0.93;
const HEADER_BORDER_BOTTOM_ALPHA = 0.28;
const ZOOM_BUTTON_BLUR = 8;
const WORD_PILL_BACKGROUND_ALPHA = 0.92;
const WORD_PILL_BLUR = 12;
const WORD_PILL_BORDER_ALPHA = 0.3;
const WORD_PILL_SHADOW_ALPHA = 0.08;
const WORD_PILL_HOVER_SHADOW_ALPHA = 0.12;
const PILL_LABEL_HOVER_COLOR = "#8b6f3e";
const PILL_DEL_COLOR = "#c8b89e";
const PILL_DEL_HOVER_COLOR = "#8b3e3e";
const DOT_COLOR = "#8b6f3e";
const WORLD_TRANSFORM_ORIGIN = "0 0";
const CARD_BACKGROUND_COLOR = "#fffdf8";
const CARD_BORDER_COLOR = "#b8a98a";
const CARD_HOVER_BORDER_COLOR = "#8b6f3e";
const DRAG_HANDLE_COLOR = "rgba(139,111,62,.5)";
const DRAG_HANDLE_BACKGROUND_COLOR = "#f4efe6";
const DRAG_HANDLE_BORDER_RADIUS = 4;
const CARD_IMAGE_BACKGROUND_COLOR = "#e8e0d0";
const LABEL_COLOR = "#8b6f3e";
const CH_COLOR = "#2c2416";
const SUB_COLOR = "#8b6f3e";
const CP_COLOR = "#4a3d2a";
const CQUOTE_COLOR = "#3a2e1a";
const CQUOTE_BORDER_COLOR = "#c8a96e";
const CMETA_COLOR = "#a08a5e";
const BADGE_BACKGROUND_COLOR = "#f0e8d8";
const BADGE_COLOR = "#8b6f3e";
const CHIP_BORDER_COLOR = "#c8b99a";
const CHIP_COLOR = "#5a4520";
const CHIP_HOVER_BACKGROUND_COLOR = "#f0e0c0";
const CHIP_HOVER_BORDER_COLOR = "#8b6f3e";
const TL_DATE_COLOR = "#8b6f3e";
const TL_TEXT_COLOR = "#4a3d2a";
const RELATED_TAG_COLOR = "#b8a98a";
const CLBL_COLOR = "#c8b89e";
const TOAST_BACKGROUND_COLOR = "#fffdf8";
const TOAST_BORDER_COLOR = "#b8a98a";
const TOAST_COLOR = "#8b3e3e";
const ROOT_BACKGROUND_COLOR = "#f4efe6";
const ROOT_BACKGROUND_IMAGE_COLOR = "#c8b89e";
const HEADER_COLOR = "#2c2416";
const HEADER_EM_COLOR = "#8b6f3e";
const SEARCH_INPUT_COLOR = "#2c2416";
const SEARCH_INPUT_PLACEHOLDER_COLOR = "#c8b89e";
const SEARCH_BUTTON_COLOR = "#8b6f3e";
const CLEAR_BUTTON_COLOR = "#b8a98a";
const CLEAR_BUTTON_BORDER_COLOR = "#b8a98a";
const CLEAR_BUTTON_HOVER_COLOR = "#8b6f3e";
const CLEAR_BUTTON_HOVER_BORDER_COLOR = "#8b6f3e";
const ZOOM_BUTTON_COLOR = "#5a4520";
const ZOOM_BUTTON_HOVER_COLOR = "#2c2416";
const ZOOM_BUTTON_HOVER_BACKGROUND = "#fff";
const ZOOM_LEVEL_COLOR = "#b8a98a";
const HINT_COLOR = "#c8b89e";
const WORD_PILL_COLOR = "#2c2416";
const WORD_PILL_HOVER_COLOR = "#8b6f3e";
const WORD_PILL_LOADING_COLOR = "#8b6f3e";
const LINKS_DASHED_STROKE_COLOR = "rgba(184,169,138,0.4)";
const LINKS_SOLID_STROKE_COLOR = "rgba(139,111,62,0.5)";
const LINKS_ARROW_FILL_COLOR = "rgba(139,111,62,0.5)";

function resolveOverlaps(positions, clusters, draggedId, iterations=OVERLAP_RESOLUTION_ITERATIONS) {
  // Build list of all card rects
  const ids = [];
  const rects = {}; // id -> {x,y,w,h}
  clusters.forEach(cl => {
    const cid = cl.centralId;
    const pos = positions[cid]||cl.centralPos;
    ids.push(cid);
    rects[cid] = {x:pos.x, y:pos.y, w:CCW, h:CCH};
    cl.cards.forEach(card => {
      const p = positions[card.id];
      if (!p) return;
      ids.push(card.id);
      rects[card.id] = {x:p.x, y:p.y, w:cw(card.type), h:ch(card.type)};
    });
  });

  const next = {};
  ids.forEach(id => { next[id] = {...rects[id]}; });

  for (let iter=0; iter<iterations; iter++) {
    for (let i=0; i<ids.length; i++) {
      for (let j=i+1; j<ids.length; j++) {
        const a=next[ids[i]], b=next[ids[j]];
        if (!boxOverlaps(a, b, PAD * OVERLAP_PUSH_FACTOR)) continue;
        // Push apart: move the non-dragged card
        const ax=a.x+a.w/2, ay=a.y+a.h/2;
        const bx=b.x+b.w/2, by=b.y+b.h/2;
        let dx=bx-ax, dy=by-ay;
        const len=Math.sqrt(dx*dx+dy*dy)||1;
        dx/=len; dy/=len;
        // overlap amount
        const ox = Math.min(a.x+a.w,b.x+b.w) - Math.max(a.x,b.x) + PAD * OVERLAP_PUSH_FACTOR;
        const oy = Math.min(a.y+a.h,b.y+b.h) - Math.max(a.y,b.y) + PAD * OVERLAP_PUSH_FACTOR;
        const push = Math.min(ox,oy) * OVERLAP_PUSH_FACTOR;
        if (ids[i]!==draggedId) { next[ids[i]].x -= dx*push; next[ids[i]].y -= dy*push; }
        if (ids[j]!==draggedId) { next[ids[j]].x += dx*push; next[ids[j]].y += dy*push; }
      }
    }
  }

  const result = {...positions};
  ids.forEach(id => { result[id] = {x:next[id].x, y:next[id].y}; });
  return result;
}

const MOCK_MELANCHOLY = {
  "word": "melancholy",
  "pronunciation": "/ˈmɛlənˌkɒli/",
  "partOfSpeech": "noun/adjective",
  "originSummary": "Traced back to the ancient theory of the four humors, where 'black bile' was thought to cause profound sadness and pensive reflection.",
  "definition": "A deep, pensive, and long-lasting sadness; often with a quality of gentle reflection or aesthetic appreciation of sorrow.",
  "imageQuery": "moody dark landscape oil painting pensive reflection",
  "etymology": [
    { "root": "melas", "language": "Ancient Greek", "meaning": "black", "context": "The first part of the compound word referring to color." },
    { "root": "khole", "language": "Ancient Greek", "meaning": "bile", "context": "The second part, referring to bodily fluids in humoral medicine." },
    { "root": "melankholia", "language": "Greek", "meaning": "black bile", "context": "The unified medical term for the state of depression." }
  ],
  "timeline": [
    { "date": "4th C. BC", "description": "Hippocrates defines it as a physical ailment caused by excess black bile." },
    { "date": "c. 1300", "description": "Enters Middle English as a term for general sadness or ill-temper." },
    { "date": "1621", "description": "Robert Burton publishes 'The Anatomy of Melancholy', exploring its psychological depths." },
    { "date": "19th C.", "description": "Becomes a hallmark of the Romantic movement, associated with artistic genius." }
  ],
  "literary": [
    { "quote": "I have of late—but wherefore I know not—lost all my mirth.", "author": "Shakespeare", "work": "Hamlet", "year": "1603" },
    { "quote": "There’s such a charm in melancholy, I would not, if I could, be gay.", "author": "Samuel Rogers", "work": "To a Friend", "year": "1814" }
  ],
  "related": [
    { "word": "pensive", "relation": "synonym" },
    { "word": "somber", "relation": "synonym" },
    { "word": "saturnine", "relation": "cognate" },
    { "word": "miserable", "relation": "antonym" },
    { "word": "nostalgia", "relation": "thematic cousin" }
  ]
};

// ── Gemini API ─────────────────────────────────────────────────────────────────
async function fetchWordData(word) {
  const trimmed = word.trim().toLowerCase();
  if (trimmed === "melancholy") return MOCK_MELANCHOLY;

  const prompt = `Generate a rich, multi-dimensional etymology and semantic profile for the word: "${word}".
Return ONLY a valid JSON object. Ensure the content is scholarly yet engaging.

{
  "word": "${word}",
  "pronunciation": "accurate IPA",
  "partOfSpeech": "primary usage",
  "originSummary": "A 2-3 sentence 'biography' of the word, tracing its emotional or conceptual journey through time.",
  "definition": "A precise, elegant 2-3 sentence definition including subtle nuances.",
  "imageQuery": "A high-quality, evocative 3-5 word query for a conceptual photograph or historical artwork representing this word.",
  "etymology": [
    { 
      "root": "root morpheme", 
      "language": "Source Language (e.g., Proto-Indo-European, Old Norse, Sanskrit)", 
      "meaning": "literal/original meaning", 
      "context": "Briefly explain the phonetic or conceptual shift." 
    }
  ],
  "timeline": [
    { 
      "date": "Specific year or century (e.g., c. 1200, 17th Century)", 
      "description": "A significant moment where the word changed meaning, was first recorded, or gained popularity." 
    }
  ],
  "literary": [
    { 
      "quote": "A powerful, evocative quote (max 18 words) using the word.", 
      "author": "Author Name", 
      "work": "Work Title", 
      "year": "Publication Year" 
    }
  ],
  "related": [
    { 
      "word": "a conceptually linked word", 
      "relation": "synonym/antonym/cognate/thematic cousin" 
    }
  ]
}

Requirements:
- Minimum 3 etymology steps (tracing back as far as possible).
- Minimum 4 timeline milestones.
- Minimum 2 literary quotes from different eras.
- Minimum 5 related words that encourage further exploration.`;

  // Define endpoints and their specific configurations for each model
  const configs = [];
  API_CONFIG.MODELS.forEach(model => {
    // Try v1beta first (JSON mode support)
    configs.push({ url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_CONFIG.GEMINI_KEY}`, useJsonMode: true });
    // Fallback to v1 (Standard mode)
    configs.push({ url: `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${API_CONFIG.GEMINI_KEY}`, useJsonMode: false });
  });

  for (const config of configs) {
    try {
      const generationConfig = { temperature: 0.2 };
      // Only v1beta supports responseMimeType
      if (config.useJsonMode) generationConfig.responseMimeType = "application/json";

      const res = await fetch(config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig
        }),
      });

      if (res.ok) {
        const d = await res.json();
        // Gemini 3 might have 'candidates[0].content.parts[0].text' or include thought blocks
        let raw = d.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        
        // Remove thinking/thought blocks if present (often enclosed in <thought> or similar)
        raw = raw.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
        
        // If not in JSON mode, we may need to strip markdown backticks
        const cleaned = raw.replace(/```json|```/g, "").trim();
        return JSON.parse(cleaned);
      } else {
        const errorBody = await res.text();
        // Redact the key from the logged URL for privacy
        const redactedUrl = config.url.split('?')[0] + "?key=REDACTED";
        console.warn(`Gemini API attempt failed (status: ${res.status})`);
        continue; // Try next config
      }
    } catch (e) {
      continue;
    }
  }

  throw new Error("Gemini API failed after trying all compatible model configurations. Please check your API key permissions in Google AI Studio.");
}

// ── Image ──────────────────────────────────────────────────────────────────────
function Img({query, h}) {
  const seed = encodeURIComponent(query||"abstract nature");
  // source.unsplash.com is deprecated; using loremflickr or picsum as fallback
  const [src,setSrc] = useState(`https://loremflickr.com/560/${h*2}/${seed}`);
  return <img className="card-img" style={{height:h}} src={src} alt=""
    onError={()=>setSrc(`https://picsum.photos/seed/${seed}/560/${h*2}`)} />;
}

// ── Live SVG Links ─────────────────────────────────────────────────────────────
// Lines are recomputed every render from current cardPositions → always accurate
function Links({clusters, cardPositions}) {
  const lines = [];

  clusters.forEach(cl => {
    const cp = cardPositions[cl.centralId]||cl.centralPos;
    const cx = cp.x + CCW/2, cy = cp.y + CCH/2;

    // Dashed lines: central ↔ each satellite
    cl.cards.forEach((card,i) => {
      const pos = cardPositions[card.id];
      if (!pos) return;
      const w=cw(card.type), h=ch(card.type);
      const tx=pos.x+w/2, ty=pos.y+h/2;
      lines.push(
        <line key={`d-${card.id}`}
          x1={cx} y1={cy} x2={tx} y2={ty}
          stroke={LINKS_DASHED_STROKE_COLOR} strokeWidth={LINE_STROKE_WIDTH_DASHED}
          strokeDasharray={LINE_STROKE_DASH_ARRAY} fill="none"
        />
      );
    });

    // Solid arrow: this cluster → parent cluster
    if (cl.parentWord) {
      const par = clusters.find(c=>c.word===cl.parentWord);
      if (par) {
        const pp = cardPositions[par.centralId]||par.centralPos;
        const px=pp.x+CCW/2, py=pp.y+CCH/2;
        const angle=Math.atan2(cy-py, cx-px);
        const aLen=ARROW_LENGTH;
        const ax2=cx-Math.cos(angle)*ARROW_HEAD_OFFSET, ay2=cy-Math.sin(angle)*ARROW_HEAD_OFFSET;
        lines.push(
          <line key={`s-${cl.word}`}
            x1={px} y1={py} x2={cx} y2={cy}
            stroke={LINKS_SOLID_STROKE_COLOR} strokeWidth={LINE_STROKE_WIDTH_SOLID} fill="none"
          />
        );
        lines.push(
          <polygon key={`a-${cl.word}`}
            points={`${ax2},${ay2} ${ax2-aLen*Math.cos(angle-ARROW_ANGLE_OFFSET)},${ay2-aLen*Math.sin(angle-ARROW_ANGLE_OFFSET)} ${ax2-aLen*Math.cos(angle+ARROW_ANGLE_OFFSET)},${ay2-aLen*Math.sin(angle+ARROW_ANGLE_OFFSET)}`}
            fill={LINKS_ARROW_FILL_COLOR}
          />
        );
      }
    }
  });

  return (
    <svg className="links-svg" style={{position:"absolute",top:0,left:0,overflow:"visible"}}>
      {lines}
    </svg>
  );
}

// ── Card drag hook ─────────────────────────────────────────────────────────────
// Returns handler for mousedown on the drag handle.
// Calls onMove(id, {x,y}) continuously; calls onDrop(id) when released (triggers repulsion).
function useDrag(id, pos, onMove, onDrop) {
  const dragging = useRef(false);
  const startMouse = useRef({x:0,y:0});
  const startPos = useRef({x:0,y:0});
  const elRef = useRef(null);

  useEffect(() => {
    const move = e => {
      if (!dragging.current) return;
      const dx = e.clientX - startMouse.current.x;
      const dy = e.clientY - startMouse.current.y;
      onMove(id, {x: startPos.current.x+dx, y: startPos.current.y+dy});
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      elRef.current?.classList.remove("is-dragging");
      document.body.style.cursor="";
      onDrop(id);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return ()=>{ window.removeEventListener("mousemove",move); window.removeEventListener("mouseup",up); };
  }, [id, onMove, onDrop]);

  const handleDown = e => {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true;
    startMouse.current = {x:e.clientX, y:e.clientY};
    startPos.current = {...pos};
    elRef.current?.classList.add("is-dragging");
    document.body.style.cursor="grabbing";
  };

  return {elRef, handleDown};
}

// ── Drag Handle ────────────────────────────────────────────────────────────────
function DragHandle({onMouseDown}) {
  return (
    <div className="drag-handle" onMouseDown={onMouseDown}>
      <svg width="20" height="5" viewBox="0 0 20 5">
        <circle cx="3"  cy="2.5" r="1.6" fill="rgba(139,111,62,.5)"/>
        <circle cx="10" cy="2.5" r="1.6" fill="rgba(139,111,62,.5)"/>
        <circle cx="17" cy="2.5" r="1.6" fill="rgba(139,111,62,.5)"/>
      </svg>
    </div>
  );
}

// ── Card wrappers ──────────────────────────────────────────────────────────────
function BaseCard({id, pos, width, delay, onMove, onDrop, children}) {
  const {elRef, handleDown} = useDrag(id, pos, onMove, onDrop);
  return (
    <div ref={elRef} className="card popin"
      style={{left:pos.x, top:pos.y, width, animationDelay:delay||"0s"}}>
      <DragHandle onMouseDown={handleDown}/>
      <div className="card-inner">{children}</div>
    </div>
  );
}

function CentralCard({id, data, pos, onNav, onMove, onDrop}) {
  const {elRef, handleDown} = useDrag(id, pos, onMove, onDrop);
  return (
    <div ref={elRef} className="card popin"
      style={{left:pos.x, top:pos.y, width:CCW, zIndex:CENTRAL_CARD_Z_INDEX,
        boxShadow:`0 4px 32px rgba(44,36,22,${CENTRAL_CARD_SHADOW_ALPHA}),0 0 0 2px rgba(139,111,62,${CENTRAL_CARD_BORDER_ALPHA})`}}>
      <DragHandle onMouseDown={handleDown}/>
      <div className="card-inner">
        <Img query={data.imageQuery||data.word} h={CARD_IMAGE_HEIGHT_CENTRAL}/>
        <div className="card-body">
          <div className="lbl">Definition</div>
          <div className="ch" style={{fontSize:CENTRAL_CARD_FONT_SIZE}}>{data.word}</div>
          <div className="sub">{data.pronunciation} · {data.partOfSpeech}</div>
          <div className="cp">{data.definition}</div>
          <div className="cp" style={{marginTop:CP_MARGIN_TOP,fontStyle:"italic",color:SUB_COLOR,fontSize:11}}>
            {data.originSummary}
          </div>
        </div>
      </div>
    </div>
  );
}

function EtymCard({id, entry, pos, onNav, onMove, onDrop, delay}) {
  return (
    <BaseCard id={id} pos={pos} width={CW} delay={delay} onMove={onMove} onDrop={onDrop}>
      <Img query={`${entry.root} ${entry.language} ancient morpheme`} h={CARD_IMAGE_HEIGHT_ETYMOLOGY}/>
      <div className="card-body">
        <div className="lbl">Etymology · {entry.language}</div>
        <div className="ch" style={{fontSize:ETYM_CARD_FONT_SIZE}}>{entry.root}</div>
        <div className="sub">"{entry.meaning}"</div>
        <div className="cp">{entry.context}</div>
        <div style={{marginTop:CP_MARGIN_TOP}}>
          <span className="chip" onClick={()=>onNav(entry.root)}>{entry.root} →</span>
        </div>
      </div>
    </BaseCard>
  );
}

function TimelineCard({id, entries, pos, onMove, onDrop, delay, word}) {
  return (
    <BaseCard id={id} pos={pos} width={TLW} delay={delay} onMove={onMove} onDrop={onDrop}>
      <Img query={`${word} historical evolution timeline`} h={CARD_IMAGE_HEIGHT_TIMELINE}/>
      <div className="card-body">
        <div className="lbl">Historical Timeline</div>
        <div className="ch" style={{fontSize:TIMELINE_CARD_FONT_SIZE,marginBottom:TIMELINE_CARD_TITLE_MARGIN_BOTTOM}}>Semantic Evolution</div>
        {entries.map((e,i)=>(
          <div className="tl-row" key={i} style={{gap:TIMELINE_ROW_GAP,marginBottom:TIMELINE_ROW_MARGIN_BOTTOM}}>
            <div className="tl-d" style={{minWidth:TIMELINE_DATE_MIN_WIDTH}}>{e.date}</div>
            <div className="tl-t">{e.description}</div>
          </div>
        ))}
        <div className="badge">Oxford English Dictionary</div>
      </div>
    </BaseCard>
  );
}

function LiteraryCard({id, entry, pos, onMove, onDrop, delay, word}) {
  return (
    <BaseCard id={id} pos={pos} width={CW} delay={delay} onMove={onMove} onDrop={onDrop}>
      <Img query={`${word} ${entry.author} vintage book quote`} h={CARD_IMAGE_HEIGHT_LITERARY}/>
      <div className="card-body">
        <div className="lbl">Literary Reference</div>
        <div className="cquote">"{entry.quote}"</div>
        <div className="cmeta" style={{marginTop:CMETA_MARGIN_TOP}}>— {entry.author}, <em>{entry.work}</em> ({entry.year})</div>
      </div>
    </BaseCard>
  );
}

function RelatedCard({id, related, pos, onNav, onMove, onDrop, delay}) {
  return (
    <BaseCard id={id} pos={pos} width={RELW} delay={delay} onMove={onMove} onDrop={onDrop}>
      <div className="card-body" style={{paddingTop:RELATED_CARD_PADDING_TOP}}>
        <div className="lbl">Related Words</div>
        <div style={{marginTop:CP_MARGIN_TOP}}>
          {related.map((r,i)=>(
            <div className="rel-row" key={i} style={{gap:RELATED_ROW_GAP,marginBottom:RELATED_ROW_MARGIN_BOTTOM}}>
              <span className="chip" onClick={()=>onNav(r.word)}>{r.word}</span>
              <span className="rel-tag">{r.relation}</span>
            </div>
          ))}
        </div>
      </div>
    </BaseCard>
  );
}

// ── Word panel ─────────────────────────────────────────────────────────────────
function WordPanel({clusters, loadingWords, onDelete, onFocus}) {
  return (
    <div className="word-panel">
      {clusters.map((cl,i)=>(
        <div key={cl.word} className="word-pill" style={{animationDelay:`${i*PILL_ANIMATION_DELAY_FACTOR}s`}}>
          <button className="pill-label" onClick={()=>onFocus(cl.anchor)}>{cl.word}</button>
          <button className="pill-del" onClick={()=>onDelete(cl.word)} title="Remove">
            <svg width="9" height="9" viewBox="0 0 9 9">
              <line x1="1.5" y1="1.5" x2="7.5" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="7.5" y1="1.5" x2="1.5" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ))}
      {loadingWords.map(w=>(
        <div key={`ld-${w}`} className="word-pill" style={{opacity:0.75}}>
          <div className="pill-loading">
            <div className="dots"><span/><span/><span/></div>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,fontStyle:"italic",color:"#8b6f3e"}}>{w}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
function EtymureApp() {
  // ── State ──
  const [clusters, setClusters]             = useState([]);
  const [cardPositions, setCardPositions]   = useState({});  // {id:{x,y}}
  const [placedRects, setPlacedRects]       = useState([]);
  const [loadingWords, setLoadingWords]     = useState([]);
  const [error, setError]                   = useState(null);
  const [searchVal, setSearchVal]           = useState("");
  // Viewport transform: pan offset + zoom scale
  const [pan, setPan]       = useState({x:0, y:0});
  const [zoom, setZoom]     = useState(1);
  const [isApiReady, setIsApiReady] = useState(!!API_CONFIG.GEMINI_KEY);

  // ── Load API Key from .env ──
  useEffect(() => {
    if (API_CONFIG.GEMINI_KEY) {
      setIsApiReady(true);
      return;
    }
    
    fetch('.env')
      .then(res => {
        if (!res.ok) throw new Error("Not found");
        return res.text();
      })
      .then(text => {
        // Match KEY=VALUE, allowing for any number of equals signs and optional quotes
        const match = text.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          // Clean up the captured value: remove leading equals, then trim and remove quotes
          let val = match[1].trim();
          while (val.startsWith('=')) val = val.substring(1).trim();
          val = val.replace(/^['"]|['"]$/g, '');
          API_CONFIG.GEMINI_KEY = val;
          console.log("Gemini API key loaded from .env (length: " + val.length + ")");
          setIsApiReady(true);
        } else {
          setError("API Key not found in .env. Please add GEMINI_API_KEY=your_key");
        }
      })
      .catch(() => {
        setError("Could not load .env file. Ensure your server is running.");
      });
  }, []);

  // ── Refs ──
  const rootRef        = useRef(null);
  const loadedSet      = useRef(new Set());
  const clustersRef    = useRef(clusters);
  const placedRef      = useRef(placedRects);
  const positionsRef   = useRef(cardPositions);
  const panDragging    = useRef(false);   // right-click pan
  const lastMouse      = useRef({x:0,y:0});
  const panButton      = useRef(1);        // 2 = right click

  useEffect(()=>{ clustersRef.current=clusters; }, [clusters]);
  useEffect(()=>{ placedRef.current=placedRects; }, [placedRects]);
  useEffect(()=>{ positionsRef.current=cardPositions; }, [cardPositions]);

  // ── Mouse handlers for pan (RIGHT click = button 2) ──
  useEffect(()=>{
    const root = rootRef.current;
    if (!root) return;

    const down = e => {
      // Right click (button 2) = pan
      if (e.button !== 2) return;
      e.preventDefault();
      panDragging.current = true;
      lastMouse.current = {x:e.clientX, y:e.clientY};
      root.style.cursor = "grabbing";
    };
    const move = e => {
      if (!panDragging.current) return;
      const dx=e.clientX-lastMouse.current.x, dy=e.clientY-lastMouse.current.y;
      lastMouse.current={x:e.clientX, y:e.clientY};
      setPan(p=>({x:p.x+dx, y:p.y+dy}));
    };
    const up = e => {
      if (!panDragging.current) return;
      panDragging.current=false;
      root.style.cursor="";
    };
    const ctx = e => e.preventDefault(); // disable context menu

    root.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    root.addEventListener("contextmenu", ctx);
    return ()=>{
      root.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      root.removeEventListener("contextmenu", ctx);
    };
  }, []);

  // ── Zoom via scroll wheel ──
  // Zooms around the mouse cursor position
  useEffect(()=>{
    const root = rootRef.current;
    if (!root) return;
    const onWheel = e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
      const rect = root.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setZoom(z => {
        const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z*delta));
        // Adjust pan so the point under cursor stays fixed
        setPan(p => ({
          x: mx - (mx - p.x) * (nz/z),
          y: my - (my - p.y) * (nz/z),
        }));
        return nz;
      });
    };
    root.addEventListener("wheel", onWheel, {passive:false});
    return ()=>root.removeEventListener("wheel", onWheel);
  }, []);

  // ── Card move (live) ──
  const handleCardMove = useCallback((id, pos) => {
    setCardPositions(p => ({...p, [id]: pos}));
  }, []);

  // ── Card drop: resolve overlaps via force repulsion ──
  const handleCardDrop = useCallback((draggedId) => {
    setCardPositions(prev => {
      return resolveOverlaps(prev, clustersRef.current, draggedId, OVERLAP_RESOLUTION_ITERATIONS);
    });
  }, []);

  // ── Focus viewport on anchor ──
  const focusAnchor = useCallback((anchor) => {
    const vw=window.innerWidth, vh=window.innerHeight;
    setZoom(z => {
      setPan({x: vw/2 - anchor.x*z, y: vh/2 - anchor.y*z});
      return z;
    });
  }, []);

  // ── Delete cluster ──
  const deleteCluster = useCallback((word) => {
    setClusters(prev => {
      const cl = prev.find(c=>c.word===word);
      if (!cl) return prev;
      setCardPositions(p => {
        const n={...p};
        cl.cards.forEach(card=>delete n[card.id]);
        delete n[cl.centralId];
        return n;
      });
      loadedSet.current.delete(word);
      return prev.filter(c=>c.word!==word);
    });
  }, []);

  // ── Load word ──
  const loadWord = useCallback((word, parentWord=null) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed || loadedSet.current.has(trimmed)) return;
    loadedSet.current.add(trimmed);
    setLoadingWords(p=>[...p, trimmed]);

    const anchor = chooseAnchor(parentWord, clustersRef.current, placedRef.current);

    fetchWordData(trimmed).then(data => {
      const cards = [];
      (data.etymology||[]).forEach((e,i)=>cards.push({id:`${trimmed}-ety-${i}`,type:"etymology",data:e}));
      if (data.timeline?.length) cards.push({id:`${trimmed}-tl`,type:"timeline",data:data.timeline});
      (data.literary||[]).forEach((e,i)=>cards.push({id:`${trimmed}-lit-${i}`,type:"literary",data:e}));
      if (data.related?.length) cards.push({id:`${trimmed}-rel`,type:"related",data:data.related});

      const {positions, usedRects} = layoutCluster(anchor.x, anchor.y, cards, placedRef.current);

      const centralId = `central-${trimmed}`;
      const centralPos = {x:anchor.x-CCW/2, y:anchor.y-CCH/2};
      positions[centralId] = centralPos;

      const newCluster = {word:trimmed, parentWord, anchor, centralId, centralPos, cards, cardData:data};

      setClusters(prev=>[...prev, newCluster]);
      setCardPositions(prev=>({...prev, ...positions}));
      setPlacedRects(usedRects);
      placedRef.current = usedRects;
      setLoadingWords(p=>p.filter(w=>w!==trimmed));

      // Pan to center new cluster
      const vw=window.innerWidth, vh=window.innerHeight;
      setPan({x: vw/2 - anchor.x*zoom, y: vh/2 - anchor.y*zoom});

    }).catch(e=>{
      console.error(e);
      setError(`Could not load content: ${e.message}`);
      loadedSet.current.delete(trimmed);
      setLoadingWords(p=>p.filter(w=>w!==trimmed));
    });
  }, [zoom]);

  useEffect(()=>{
    if (!error) return;
    const t=setTimeout(()=>setError(null),TOAST_DISPLAY_DURATION);
    return ()=>clearTimeout(t);
  }, [error]);

  const handleSearch = e => {
    e.preventDefault();
    const w=searchVal.trim();
    if (!w || loadingWords.length > 0) return;
    loadWord(w, clusters[clusters.length-1]?.word||null);
    setSearchVal("");
  };

  const handleRandom = () => {
    if (loadingWords.length > 0) return;
    const filtered = RANDOM_WORDS.filter(w => !loadedSet.current.has(w));
    const pool = filtered.length > 0 ? filtered : RANDOM_WORDS;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    loadWord(picked, clusters[clusters.length-1]?.word||null);
  };

  const clearCanvas = () => {
    setClusters([]); setCardPositions({}); setPlacedRects([]);
    loadedSet.current.clear(); placedRef.current=[];
    setPan({x:0,y:0}); setZoom(1);
  };

  const zoomBy = delta => {
    const vw=window.innerWidth, vh=window.innerHeight;
    setZoom(z => {
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z*delta));
      setPan(p=>({x: vw/2-(vw/2-p.x)*(nz/z), y: vh/2-(vh/2-p.y)*(nz/z)}));
      return nz;
    });
  };

  // ── Transform string for canvas ──
  const transform = `translate3d(${pan.x}px,${pan.y}px,0) scale(${zoom})`;

  return (
    <div className="root" ref={rootRef}>
       
      {/* Header */}
      <div className="hdr">
        <div className="logo">etym<em>ure</em></div>
        <form className="srch-wrap" onSubmit={handleSearch}>
          <input 
            placeholder={loadingWords.length > 0 ? `Loading "${loadingWords[0]}"...` : "Explore a word…"} 
            value={searchVal}
            onChange={e=>setSearchVal(e.target.value)}
            disabled={loadingWords.length > 0}
          />
          <button type="submit" className="srch-btn" disabled={loadingWords.length > 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </form>
        <div className="hdr-spacer"/>
        <button className="clr-btn" style={{marginRight:8}} onClick={()=>loadWord("melancholy")} disabled={loadingWords.length > 0}>
          {loadingWords.length > 0 ? "..." : "Test"}
        </button>
        <button className="clr-btn" style={{marginRight:8}} onClick={handleRandom} disabled={loadingWords.length > 0}>
          {loadingWords.length > 0 ? "..." : "Random"}
        </button>
        {clusters.length>0 && <button className="clr-btn" onClick={clearCanvas}>Clear canvas</button>}
      </div>

      {/* Left word panel */}
      <WordPanel clusters={clusters} loadingWords={loadingWords}
        onDelete={deleteCluster} onFocus={focusAnchor}/>

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={()=>zoomBy(ZOOM_IN_FACTOR)} title="Zoom in">+</button>
        <button className="zoom-btn" onClick={()=>zoomBy(ZOOM_OUT_FACTOR)} title="Zoom out">−</button>
        <button className="zoom-btn" style={{fontSize:10,letterSpacing:".04em"}}
          onClick={()=>{setZoom(1);setPan({x:0,y:0})}} title="Reset zoom">⟳</button>
        <div className="zoom-level">{Math.round(zoom*100)}%</div>
      </div>

      {error && <div className="toast">{error}</div>}

      {clusters.length>0 && loadingWords.length===0 && (
        <div className="hint">Right-click drag to pan · Scroll to zoom · Drag card handles to move</div>
      )}

      {/* Canvas */}
      <div className="world" style={{transform}}>
        <div className="bg-dots" />
        
        {/* Live SVG lines — redrawn from current cardPositions every render */}
        <Links clusters={clusters} cardPositions={cardPositions}/>

        {clusters.map(cl => {
          const cPos = cardPositions[cl.centralId]||cl.centralPos;
          const nav = w=>loadWord(w, cl.word);
          return (
            <div key={`g-${cl.word}`}>
              <div className="clbl" style={{left:cPos.x+CCW/2, top:cPos.y+CLBL_Y_OFFSET}}>
                {cl.word}
              </div>
              <CentralCard id={cl.centralId} data={cl.cardData} pos={cPos}
                onNav={nav} onMove={handleCardMove} onDrop={handleCardDrop}/>
              {cl.cards.map((card,i)=>{
                const pos=cardPositions[card.id];
                if (!pos) return null;
                const delay=`${i*.07+.12}s`;
                const props={id:card.id, pos, onMove:handleCardMove, onDrop:handleCardDrop, delay, word:cl.word};
                if (card.type==="etymology")
                  return <EtymCard key={card.id} {...props} entry={card.data} onNav={nav}/>;
                if (card.type==="timeline")
                  return <TimelineCard key={card.id} {...props} entries={card.data}/>;
                if (card.type==="literary")
                  return <LiteraryCard key={card.id} {...props} entry={card.data}/>;
                if (card.type==="related")
                  return <RelatedCard key={card.id} {...props} related={card.data} onNav={nav}/>;
                return null;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<EtymureApp />);