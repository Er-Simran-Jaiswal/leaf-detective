# Leaf Detective

A small web app that helps you identify plants and bird sounds while you are **outside**, using open-source AI that runs **inside your browser**. There is no backend, no API key and no account.

Built for the **Touch Grass** open-source AI challenge: build something with open-weight models that gets people off the screen and into the world.

> **Screenshots:** add 2 or 3 photos here (the app on your phone, and you using it outdoors).
> `![Leaf Detective on my phone](screenshots/phone.jpg)`

---

## What it does

| Feature | What happens |
|---|---|
| **Photo ID** | Take or pick a photo of a leaf, flower or bird. The app names it from a list of labels you control. |
| **Fun facts and a challenge** | A small language model writes 2 short facts and a 5-minute outdoor challenge for what you found. |
| **Bird call listener** | Record 8 seconds of sound. The app tells you whether it hears a bird-type sound. |
| **Field log** | Every find is saved on your device with a thumbnail and a time. |
| **Look-up break** | After a find, a 10-minute lock screen tells you to put the phone away and look around. You can turn it off or skip it. |

The screen is meant to be the shortest part of the experience.

---

## Why open-source AI matters here

| Reason | How this project uses it |
|---|---|
| **Privacy** | Your photos and recordings are processed in your browser and are never uploaded to a server. |
| **Cost** | No API bills. Hosting is free on GitHub Pages. |
| **Swappable** | You can change the plant list, the language model or the sound model by editing a few lines. No permission needed. |
| **Works with weak signal** | After the models are downloaded once, the AI itself does not need a connection. See *Limitations* for what is and isn't tested. |
| **Inspectable** | Every model and library is open, so anyone can check what the app is doing. |

---

## Tech stack

| Part | Tool | Job |
|---|---|---|
| Image recognition | [Transformers.js](https://github.com/huggingface/transformers.js) 3.0.0 with `Xenova/clip-vit-base-patch32` | Zero-shot image classification: matches a photo to the labels you give it |
| Facts and challenges | [WebLLM](https://github.com/mlc-ai/web-llm) 0.2.79 with `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | A small language model that runs in the browser using WebGPU |
| Bird sounds | Transformers.js with `Xenova/ast-finetuned-audioset-10-10-0.4593` | Audio classification (AudioSet sound labels) |
| Storage | `localStorage` | Keeps the field log on your device |
| Front end | Plain HTML, CSS and JavaScript | No framework, no build step |

---

## Project structure

```
leaf-detective/
├── index.html   # the page
├── app.js       # all the logic: photo ID, facts, bird listener, log, look-up break
├── style.css    # the green field-guide look
└── README.md
```

---

## Run it on your computer

You need **Python 3** (already on most Macs) and **Chrome or Edge**.

1. Download or clone this repo.
2. Open a terminal in the project folder.
3. Start a local server:
   ```bash
   python3 -m http.server 8000
   ```
4. Open `http://localhost:8000` in Chrome.
5. Wait for the status line to say **Ready**. The first load downloads the models, so use Wi-Fi.

> **Do not open `index.html` by double-clicking it.** Pages opened as `file:///` cannot load the AI scripts, and the camera and microphone will not work either. Always use `http://localhost`.

### Deploy to GitHub Pages (free)

1. Push the files to a GitHub repository.
2. Go to **Settings → Pages**.
3. Under **Source**, choose the `main` branch and the `/ (root)` folder, then save.
4. Open the link GitHub gives you on your phone while online, and let it reach **Ready**.

---

## How to use it

1. **Identify a plant or bird:** tap the big box and take a photo, or choose one from your gallery. On a computer you can also drag a photo onto the page.
2. **Read the result:** you get a name and a confidence percentage. Below 35% the app says *Not sure* and shows its best guess.
3. **Get facts:** the language model writes facts and a short outdoor challenge. The first one is slow because the model loads in the background.
4. **Listen for birds:** tap **Listen for 8 seconds**, allow the microphone, and keep quiet.
5. **Check your log:** all finds appear in the Field log and stay after you refresh.

---

## Make it your own

### Change what it can recognise

Open `app.js` and edit the list at the top:

```js
const LABELS = [
  "neem leaf", "peepal leaf", "mango leaf", "banyan leaf", "tulsi plant",
  "hibiscus flower", "marigold flower", "lotus flower",
  "crow", "sparrow", "myna", "pigeon", "parakeet", "kingfisher"
];
```

The model can only choose from this list, so it will always pick *something*. Use names of plants and birds near you, and add more to improve results.

### Other settings in `app.js`

| Setting | What it does |
|---|---|
| `MIN_CONFIDENCE` | Below this score the app says "Not sure" (default `0.35`) |
| `LLM_ID` | The language model used for facts. Any model from the WebLLM prebuilt list works |
| `BREAK_SECONDS` | Length of the look-up break (default 10 minutes) |
| `RECORD_SECONDS` | Length of the bird recording (default 8 seconds) |
| `FALLBACK` | Backup facts shown when the browser has no WebGPU |

---

## How it works

```
Photo  ──►  CLIP (Transformers.js)  ──►  best label  ──►  Qwen2.5 (WebLLM)  ──►  facts + challenge
                                              │
                                              └──►  saved to the field log (localStorage)

Sound  ──►  AST audio model (Transformers.js)  ──►  keep only bird-related labels  ──►  top 3 shown
```

- **CLIP** compares the photo with the sentence "a photo of a {label}" for every label and returns the closest one.
- **WebLLM** runs a small chat model with your graphics card through WebGPU, so no server is involved.
- **The bird listener** records with `MediaRecorder`, converts the sound to 16 kHz audio, and runs an audio model that predicts sound categories. The app keeps only bird-related ones.

---

## Limitations (please read)

This is a weekend project, and these limits are real:

- **Bird sounds are general, not species.** The audio model recognises categories such as bird, crow, owl and chirp. It does **not** tell a sparrow from a myna. For species-level results you would need a model like BirdNET.
- **Photo ID depends on your label list.** CLIP picks the closest label even if the true answer is missing. Similar-looking leaves are often confused, and blurry or badly lit photos give poor results.
- **Small language models make mistakes.** The 0.5B model can state wrong facts with confidence. Treat the facts as fun, not as a field guide.
- **WebGPU is needed for facts.** Recent Chrome and Edge are the safest choices. Without WebGPU the app still identifies photos and listens for birds, but fun facts appear only for the few labels in `FALLBACK`.
- **First load needs internet.** Libraries and models download once. After that the AI runs on your device. Full offline use has **not** been verified on every device. Check it yourself: load the app, turn on airplane mode and reload. If the page does not open offline, adding a service worker to cache the app files is the next step.
- **Large first download.** The models together are several hundred MB. Use Wi-Fi.
- **Library versions are pinned** (Transformers.js 3.0.0, WebLLM 0.2.79). Newer versions may need small code changes.

---

## Field test

> Replace this section with your own results. Judges and readers like honesty.

| Subject | What I photographed or recorded | App said | Correct? | Notes |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

**What worked:**

**What failed:**

**What I would improve:**

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Stuck on "Loading the plant brain…" | You opened the file directly. Use `python3 -m http.server 8000` and go to `http://localhost:8000`. |
| Stuck at "Downloading vision model…" | Check your internet. The first download is large. |
| Photo opens in a new tab | The page was out of date. Hard refresh with **Cmd + Shift + R** (Mac) or **Ctrl + Shift + R**. |
| Microphone does nothing | Allow microphone access in the browser. It only works on `localhost` or `https`. |
| No fun facts | Your browser may lack WebGPU. Try recent Chrome or Edge, and check the browser console for errors. |
| Wrong plant name | Add the correct plant to `LABELS` in `app.js`. |

---

## Ideas for next steps

- Add a service worker so the app shell loads with no signal
- Add a "Quest Maker" mode: a 20-minute outdoor mission based on mood and time
- Use a species-level bird model
- Add local plant labels for different regions
- Export the field log as a shareable page

---

## Credits

- [Transformers.js](https://github.com/huggingface/transformers.js) by Hugging Face
- [WebLLM](https://github.com/mlc-ai/web-llm) by MLC AI
- [CLIP](https://github.com/openai/CLIP), [Qwen2.5](https://github.com/QwenLM/Qwen2.5) and the [Audio Spectrogram Transformer](https://github.com/YuanGongND/ast) models

Check each model's own license before reusing or redistributing it.

## License

Add a license for your own code, for example MIT, by creating a `LICENSE` file in the repo.
