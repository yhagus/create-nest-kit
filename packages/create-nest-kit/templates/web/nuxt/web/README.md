# web

The front end: [Nuxt](https://nuxt.com/docs) as a single-page app, with Tailwind CSS and
[shadcn-vue](https://shadcn-vue.com). It is its own package, installed and run with bun; the API
in the parent folder doesn't depend on it.

```bash
bun install
bun run dev        # http://localhost:5173
bun run generate   # static files in .output/public, for any static host
bun run preview    # serves that build locally
```

Add shadcn-vue components with `bunx shadcn-vue@latest add <component>`; they land in
`app/components/ui/`. Until the first one, Nuxt warns that this folder doesn't exist.
