# Templates are copied verbatim, with no template language

Template files are real TypeScript, JSON and YAML, copied into the generated project as they are (apart from relocation). There are no placeholders and layers never override each other's files: every project path has exactly one owning layer. This keeps every template runnable, so the matrix can typecheck, lint and format it inside each generated project. Anything that depends on an option becomes its own layer, a manifest value (env vars, scripts, README text) or an env var the code reads at runtime.
