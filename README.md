# Virgilio · Tesauro contextual del español

A dynamic, context-aware thesaurus. You give it a word — ideally inside the
sentence where you're using it — and it draws a navigable **web of synonyms
tuned to that exact sense**, grouped by nuance and register, with regional
notes, a distinguishing *matiz* for each synonym, an example that rewrites your
sentence, and cautions about false synonyms. Click any synonym to keep
exploring.

The linguistics is handled by Claude; the app is a thin, fast shell around it.

## Structure

```
index.html · styles.css · app.js   the frontend (interactive SVG synonym web)
api/thesaurus.js                    Vercel serverless function (the backend)
lib/thesaurus.js                    shared Claude logic (used by api + local server)
server.js                           local dev server only (not used on Vercel)
```

On Vercel, the root files are served as static assets and `api/thesaurus.js`
runs on demand. The API key lives in Vercel's project settings — never in the
repo.

## Deploy to Vercel (free, no credit card)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New →
   Project** → import the repo. Framework preset: **Other** (no build step).
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY` with your key from
   [console.anthropic.com](https://console.anthropic.com).
4. **Deploy.** Vercel gives you a public URL.

## Run locally

```bash
npm install
cp .env.example .env        # paste your ANTHROPIC_API_KEY
npm start                   # → http://localhost:3000
```

## Configuration

| Variable            | Default           | Notes                                            |
| ------------------- | ----------------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY` | —                 | Required.                                        |
| `VIRGILIO_MODEL`    | `claude-opus-4-8` | Set to `claude-haiku-4-5` for cheaper/faster lookups. |
| `PORT`              | `3000`            | Local dev only.                                  |

## Roadmap

- **Grounding layer** — cross-check synonyms against a dictionary/corpus.
- **Caching** — store common lookups so repeats are instant and free.
- **Learning loop** — save explored words, spaced repetition.
- **Regional control** — toggle peninsular / rioplatense / chileno.
