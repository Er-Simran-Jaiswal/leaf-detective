import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0";
import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm";

/* ---------- EDIT THIS: what the app can recognise ---------- */
const LABELS = [
  "neem leaf", "peepal leaf", "mango leaf", "banyan leaf", "tulsi plant",
  "hibiscus flower", "marigold flower", "lotus flower",
  "crow", "sparrow", "myna", "pigeon", "parakeet", "kingfisher"
];
const MIN_CONFIDENCE = 0.35;           // below this we say "not sure"
const LLM_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const BREAK_SECONDS = 10 * 60;

/* Backup facts if the browser has no WebGPU */
const FALLBACK = {
  "neem leaf": "Neem twigs have long been used as natural toothbrushes.\nThe leaves are bitter and used in traditional medicine.\nChallenge: find 3 different tree leaves in 5 minutes.",
  "peepal leaf": "The peepal has a heart-shaped leaf with a long tip.\nIt gives off oxygen even at night, as many people say.\nChallenge: sit under a tree for 5 minutes, no phone."
};

const $ = id => document.getElementById(id);
env.allowLocalModels = false;

/* ---------- Load models ---------- */
let classifier, engine;

async function init() {
  try {
    classifier = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32",
      { progress_callback: p => { if (p.status === "progress") $("status").textContent = `Downloading vision model… ${Math.round(p.progress)}%`; } });
    $("photo").disabled = false;
    $("status").textContent = "Ready. Works offline once loaded.";
  } catch (e) {
    $("status").textContent = "Could not load the vision model. Connect to the internet once.";
    console.error(e);
    return;
  }
  // Language model loads in the background (needs WebGPU)
  if (navigator.gpu) {
    try {
      engine = await webllm.CreateMLCEngine(LLM_ID);
    } catch (e) { console.warn("LLM unavailable, using fallback facts", e); }
  }
}

/* ---------- Identify + explain ---------- */
async function identify(url) {
  const out = await classifier(url, LABELS);
  return out[0]; // { label, score }
}

async function explain(name) {
  if (!engine) return FALLBACK[name] || "Fun facts need WebGPU (recent Chrome or Edge).\nChallenge: look for this again on your walk home.";
  const r = await engine.chat.completions.create({
    max_tokens: 120,
    messages: [
      { role: "system", content: "You are a friendly naturalist. Be short and accurate. If unsure, say so." },
      { role: "user", content: `Give 2 short fun facts about ${name}. Then one 5-minute outdoor challenge starting with "Challenge:".` }
    ]
  });
  return r.choices[0].message.content;
}

/* ---------- Field log ---------- */
const KEY = "leaf-detective-log";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
function save(entry) {
  const log = [entry, ...load()].slice(0, 30);
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) { console.warn(e); }
  render();
}
function render() {
  const log = load();
  $("empty").hidden = log.length > 0;
  $("log").innerHTML = "";
  for (const e of log) {
    const li = document.createElement("li");
    li.innerHTML = `<img alt=""><div><b></b><small></small></div>`;
    li.querySelector("img").src = e.thumb;
    li.querySelector("b").textContent = e.name;
    li.querySelector("small").textContent = new Date(e.time).toLocaleString();
    $("log").append(li);
  }
}

function thumbnail(img) {
  const c = document.createElement("canvas"); c.width = c.height = 96;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 96, 96);
  return c.toDataURL("image/jpeg", 0.6);
}

/* ---------- Look-up break ---------- */
let tick;
function startBreak() {
  if (!$("breakToggle").checked) return;
  let left = BREAK_SECONDS;
  $("lock").hidden = false;
  const paint = () => { $("timer").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; };
  paint();
  clearInterval(tick);
  tick = setInterval(() => { left--; paint(); if (left <= 0) endBreak(); }, 1000);
}
function endBreak() { clearInterval(tick); $("lock").hidden = true; }
$("skip").onclick = endBreak;

/* ---------- Main flow ---------- */
$("photo").addEventListener("change", async ev => {
  const file = ev.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  $("result").hidden = false;
  $("preview").src = url;
  $("name").textContent = "Looking closely…";
  $("confidence").textContent = "";
  $("facts").textContent = "";
  await $("preview").decode().catch(() => {});

  const best = await identify(url);
  if (best.score < MIN_CONFIDENCE) {
    $("name").textContent = "Not sure";
    $("confidence").textContent = `Best guess: ${best.label} (${Math.round(best.score * 100)}%). Try a closer, sharper photo.`;
    $("facts").textContent = "";
    return;
  }
  $("name").textContent = best.label;
  $("confidence").textContent = `${Math.round(best.score * 100)}% sure`;
  $("facts").textContent = "Writing facts…";
  save({ name: best.label, time: Date.now(), thumb: thumbnail($("preview")) });
  $("facts").textContent = await explain(best.label);
  setTimeout(startBreak, 4000); // let them read first
  ev.target.value = "";
});

render();
init();

/* ================= BIRD LISTENER ================= */
const RECORD_SECONDS = 8;
const BIRDY = /bird|crow|caw|owl|chirp|tweet|pigeon|dove|coo|duck|goose|quack|rooster|crowing|hen|fowl|squawk|songbird|cuckoo/i;

let birdModel;
async function getModel() {
  if (!birdModel) {
    birdModel = await pipeline("audio-classification", "Xenova/ast-finetuned-audioset-10-10-0.4593", {
      progress_callback: p => {
        if (p.status === "progress") $("birdStatus").textContent = `Downloading sound model (first time only)… ${Math.round(p.progress)}%`;
      }
    });
  }
  return birdModel;
}

async function record() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  const done = new Promise(res => (rec.onstop = res));
  rec.start();
  for (let s = RECORD_SECONDS; s > 0; s--) {
    $("birdStatus").textContent = `Listening… ${s}s`;
    await new Promise(r => setTimeout(r, 1000));
  }
  rec.stop();
  await done;
  stream.getTracks().forEach(t => t.stop());
  return new Blob(chunks, { type: rec.mimeType });
}

async function toSamples(blob) {
  const ctx = new AudioContext({ sampleRate: 16000 }); // the model expects 16 kHz
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  return audio.getChannelData(0);
}

$("listen").addEventListener("click", async () => {
  const btn = $("listen");
  btn.disabled = true;
  $("birdResult").hidden = true;
  try {
    const model = await getModel();
    const samples = await toSamples(await record());
    $("birdStatus").textContent = "Working it out…";
    const out = await model(samples, { top_k: 15 });
    const birds = out.filter(o => BIRDY.test(o.label) && o.score > 0.05).slice(0, 3);
    $("birdList").innerHTML = "";
    for (const o of birds) {
      const li = document.createElement("li");
      li.textContent = `${o.label} (${Math.round(o.score * 100)}%)`;
      $("birdList").append(li);
    }
    $("birdNote").textContent = birds.length
      ? "This model hears bird sounds in general, not exact species."
      : `No clear bird sound. Mostly heard: ${out[0].label}. Get closer and stay quiet.`;
    $("birdResult").hidden = false;
    $("birdStatus").textContent = "Done. Look up and try to spot it.";
  } catch (e) {
    console.error(e);
    $("birdStatus").textContent = "Could not listen. Allow microphone access and try again.";
  }
  btn.disabled = false;
});