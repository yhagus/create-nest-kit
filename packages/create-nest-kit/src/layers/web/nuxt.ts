import type { LayerManifest } from '../types.ts';

/**
 * The front end of `--type fullstack`: a Nuxt single-page app in `web/`. It is a package of its
 * own, installed and run with bun whatever the API uses, so it adds nothing to the root manifest.
 */
export const nuxtWebLayer: LayerManifest = {
  id: 'web/nuxt',
  status: 'ready',
  when: (options) => options.projectType === 'fullstack',
  readme: [
    {
      title: 'Front end (web/)',
      body: `
- \`web/\` is a Nuxt single-page app with Tailwind CSS and shadcn-vue. It has its own \`package.json\` and \`node_modules\`, installed and run with bun; nothing in the API imports it, and the API's lint, format, typecheck and Docker image skip it.
- \`bun run dev\` in \`web/\` serves it at http://localhost:5173, the origin \`.env\` already allows (\`CORS_ORIGINS\`) and links to in mails (\`WEB_APP_URL\`).
- \`bun run generate\` builds static files into \`web/.output/public\`, deployed separately from the API. Add the deployed origin to \`CORS_ORIGINS\` and set \`WEB_APP_URL\` to it.
- Keep it on the same site as the API (e.g. \`app.example.com\` and \`api.example.com\`): the refresh cookie is \`SameSite=Strict\`, so a browser won't send it from another site.
- Add shadcn-vue components with \`bunx shadcn-vue@latest add <component>\` in \`web/\`.
`,
    },
  ],
};
