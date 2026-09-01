# HAY Engine render worker

This package is intentionally isolated from the Next.js web app. Heavy MP4 rendering should run in a dedicated worker/container rather than inside a short-lived web request.

## Local studio

```bash
cd render-worker
npm install
npm run studio
```

## Render sample

```bash
npm run render:sample
```

The `HAY-Reel` composition accepts this input contract:

```json
{
  "project": { "...": "CreatorProject-compatible render fields" },
  "sceneImages": { "s2": "https://.../scene.png" },
  "audioSrc": "https://.../voice.mp3"
}
```

The renderer overlays Armenian typography itself. Generated scene images remain text-free.

## Production direction

1. Web app creates a `CreatorProject`.
2. Media jobs generate/upload scene assets and voice.
3. A queue sends the final manifest to this worker.
4. Worker renders MP4 and uploads it to object storage.
5. Web app changes project state to `rendered` and exposes the download/share URL.
