# Multi-Angle 3D Camera — Unlimited

Upload any photo, then re-render it from a new camera angle. Adjust azimuth, elevation, and distance with a live 3D orbit controller. Unlimited generations, no queue, no signup.

Inspired by the [multimodalart/qwen-image-multiple-angles-3d-camera](https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera) Hugging Face Space — rebuilt as an unlimited Next.js web app.

## Features

- **Drag & drop upload** — JPG / PNG / WebP, up to 8 MB. Images stay in the browser as base64 data URLs (no server-side storage).
- **3D camera orbit visualization** — a draggable camera marker orbits around a central subject sphere. Drag it to set azimuth + elevation in real time.
- **Three precision sliders** — Azimuth (-180° to 180°), Elevation (-90° to 90°), Distance (0.5× to 3×).
- **12 quick presets** — Front, Right 45°, Left 45°, Right Side, Left Side, Back, High Angle, Top Down, Low Angle, Wide Shot, Close Up, Cinematic.
- **Auto aspect-ratio detection** — the API route reads PNG/JPEG dimension headers and picks the closest supported output size to preserve the source aspect ratio.
- **Result panel** with Compare mode (original vs generated side-by-side), Zoom dialog, Download button, prompt viewer, and Regenerate button.
- **History gallery** — grid of past generations (up to 60), each with hover actions (zoom, download, delete). Persisted across reloads via Zustand.
- **Fully responsive** — works on mobile (390×844) and desktop (1440×900+).
- **Unlimited** — no queue, no rate limit, no signup.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: Zustand + persist middleware
- **Image AI**: `z-ai-web-dev-sdk` `images.generations.edit` API (server-side only)
- **Visualization**: Pure CSS 3D transforms (no Three.js)
- **Toasts**: sonner

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- bun (or npm / yarn / pnpm)

### Install & Run

```bash
# Install dependencies
bun install

# Run dev server
bun run dev
# → http://localhost:3000
```

### Production Build

```bash
bun run build
bun run start
```

## How It Works

1. User uploads a photo → converted to a base64 data URL in the browser.
2. User picks a camera angle via the 3D orbit, sliders, or presets.
3. `src/lib/camera.ts` translates the (azimuth, elevation, distance) tuple into a natural-language prompt, e.g.:
   > "Re-render the exact same scene... from a new camera position. New camera: right side view, 90° to the right (three-quarter right profile), eye-level camera, slightly farther than original..."
4. The browser POSTs `{ image, params }` to `/api/generate`.
5. The API route calls `zai.images.generations.edit({ prompt, images: [{ url: dataUrl }], size })`.
6. The returned base64 image is shown in the result panel and pushed to history.

## Project Structure

```
src/
├── app/
│   ├── api/generate/route.ts    # POST endpoint: image + params → generated view
│   ├── globals.css              # Dark futuristic theme, glassmorphism, 3D orbit styles
│   ├── layout.tsx               # Root layout with sonner toaster
│   └── page.tsx                 # Main page: sticky header + hero + 2-col layout + sticky footer
├── components/
│   ├── camera/
│   │   ├── camera-controls.tsx  # 3 sliders + 12 preset buttons
│   │   ├── camera-orbit.tsx     # CSS 3D orbit visualization, draggable camera marker
│   │   ├── generate-button.tsx  # Primary CTA
│   │   ├── history-gallery.tsx  # Grid of past generations with hover actions
│   │   ├── image-dropzone.tsx   # Drag & drop uploader
│   │   ├── result-viewer.tsx    # Result panel with compare / zoom / download / regenerate
│   │   └── use-generate.ts      # Shared generate hook (used by button + regenerate)
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── camera.ts                # Camera-param helpers, presets, prompt builder
│   ├── db.ts                    # Prisma client (unused by this app)
│   └── utils.ts                 # cn() helper
└── store/
    └── app-store.ts             # Zustand store with persist (history survives reloads)
```

## Unlimited GPU Capacity (Multi-Space Failover)

By default, this app uses the public HF Space `multimodalart/qwen-image-multiple-angles-3d-camera` — shared ZeroGPU quota with everyone. If many people use it simultaneously, the queue can get long.

To get **unlimited** (or much higher) GPU capacity, duplicate the Space to your own Hugging Face account. This gives you dedicated ZeroGPU quota separate from the public Space.

### Setup

1. Click this link to duplicate the Space (free, takes 30 seconds):
   👉 https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera?duplicate=true

2. After duplication completes (~2 minutes), you'll get a URL like:
   ```
   https://your-username-qwen-image-multiple-angles-3d-camera.hf.space
   ```

3. Set the `HF_SPACE_URLS` environment variable in your deployment:
   ```
   HF_SPACE_URLS=https://your-username-qwen-image-multiple-angles-3d-camera.hf.space
   ```

4. (Optional) Duplicate multiple times and comma-separate URLs for round-robin failover:
   ```
   HF_SPACE_URLS=https://user1-space.hf.space,https://user2-space.hf.space,https://multimodalart-qwen-image-multiple-angles-3d-camera.hf.space
   ```

5. Redeploy. The app will automatically:
   - Try each Space in order
   - Skip Spaces with long queues (>50 people or >3min ETA)
   - Fall back to the next Space on any error
   - Use the original public Space as final fallback

### How failover works

When you click "Generate":
1. The API route calls `generateCameraEdit(image, params)`
2. The client iterates through `HF_SPACE_URLS` (or default public Space)
3. For each Space:
   - Uploads the image
   - Joins the queue
   - Streams SSE updates
   - If queue >50 or ETA >3min → abandon, try next Space
   - If process_completed → download result, return
4. If all Spaces fail → return error to user

### Vercel env var setup

In Vercel dashboard → Project → Settings → Environment Variables:
- Name: `HF_SPACE_URLS`
- Value: `https://your-username-qwen-image-multiple-angles-3d-camera.hf.space`
- Environment: Production (and Preview if you want)

After saving, redeploy for it to take effect.

## Deploy to Vercel

This is a standard Next.js 16 app — deploy like any other:

### Option A: Import from GitHub (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new).
3. Import the repo.
4. Framework preset: **Next.js** (auto-detected).
5. No environment variables needed (the `z-ai-web-dev-sdk` reads its config from `.env` locally; on Vercel you'll need to set the equivalent — see below).
6. Click **Deploy**.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Environment Variables

If the `z-ai-web-dev-sdk` requires an API key in your environment, set it in **Vercel → Project → Settings → Environment Variables**:

| Name | Value |
|------|-------|
| `ZAI_API_KEY` | your-z-ai-api-key |

(In the sandbox this is auto-injected; on Vercel you must set it manually.)

## Tips for Best Results

- Use a clearly composed photo with a single main subject (a person, a product, a pet, a vehicle).
- Extreme angle changes (e.g., 180° back view) work best on objects; landscapes tolerate moderate azimuth shifts.
- Generation typically takes 15–40 seconds per view.

## License

MIT — do whatever you want.

## Credits

- Original HF Space: [multimodalart/qwen-image-multiple-angles-3d-camera](https://huggingface.co/spaces/multimodalart/qwen-image-multiple-angles-3d-camera)
- Built with [Next.js](https://nextjs.org), [shadcn/ui](https://ui.shadcn.com), [Tailwind CSS](https://tailwindcss.com), and [z-ai-web-dev-sdk](https://www.npmjs.com/package/z-ai-web-dev-sdk).

## Live Demo

[![Vercel](https://img.shields.io/badge/Vercel-Live-brightgreen?logo=vercel)](https://my-project-sage-three-98.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/machie38-m/multi-angle-3d-camera)

**Production URL**: https://my-project-sage-three-98.vercel.app
