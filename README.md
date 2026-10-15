# Board

A full-screen infinite canvas for notes: write anywhere, draw lines / arrows / rectangles / circles,
connect notes with arrows, paste images and screenshots, change background and text color,
and keep multiple boards. Data is stored in Supabase.

Built with React + Vite + [Excalidraw](https://github.com/excalidraw/excalidraw) + Supabase.

## Shortcuts

| Key | Tool |
| --- | --- |
| `T` or double-click | Text |
| `R` | Rectangle |
| `O` | Circle / ellipse |
| `A` | Arrow (drag from one box to another to connect them) |
| `L` | Line |
| `P` | Pen (free draw) |
| `V` | Select |
| `Ctrl+V` | Paste image / screenshot |
| Space + drag / scroll | Pan · `Ctrl` + scroll to zoom |

Top-right toolbar: **BG** = background color, **A** = text color (applies to selected text and new text),
⛶ = fullscreen, ☰ = all boards, **+** = new board. Everything autosaves.

## 1. Supabase setup

1. Create a new project at https://supabase.com.
2. **SQL Editor → New query** → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Optional (single user): **Authentication → Sign In / Providers → Email** → turn off **Confirm email**
   so you can sign in immediately after creating your account.
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.

## 2. Run locally

```bash
cp .env.example .env.local   # then paste your URL and anon key into it
npm install
npm run dev
```

Open http://localhost:5173 and create an account.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/board.git
git push -u origin main
```

## 4. Deploy on Vercel

1. https://vercel.com/new → import the GitHub repo (framework is auto-detected as Vite).
2. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy.
4. In Supabase, **Authentication → URL Configuration**: set **Site URL** to your Vercel URL
   (needed for the confirmation emails to link back correctly).
