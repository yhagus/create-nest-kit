export const HELP_TEXT = `Usage: create-nest-kit [dir] [options]

Scaffolds a NestJS 12 API. Any option given as a flag is not asked for.

Options:
  --platform <fastify|express>              HTTP platform (default: fastify)
  --db <postgres|mongodb>                   Database (default: postgres)
  --orm <drizzle|prisma|typeorm|mikroorm|mongoose>
                                            ORM / ODM (default: drizzle, or mongoose for MongoDB)
  --auth <jwt|nest>                         Hand-rolled JWT or official @nestjs/authentication (default: jwt)
  --validation <zod|class-validator|valibot|arktype>
                                            Validation library (default: zod)
  --[no-]email-verification                 Require email verification (default: on)
  --[no-]csrf                               CSRF protection (default: on)
  --pm <pnpm|npm|yarn|bun>                  Package manager (default: the one running this command;
                                            otherwise asked, or npm with --yes)
  --no-install                              Don't install dependencies
  --no-git                                  Don't initialize a git repository
  -y, --yes                                 Use defaults for everything not given; don't prompt
  --force                                   Write into a non-empty directory without asking
  --dry-run                                 Show what would be generated; write nothing
  -h, --help                                Show this help
  -v, --version                             Show the version
`;
