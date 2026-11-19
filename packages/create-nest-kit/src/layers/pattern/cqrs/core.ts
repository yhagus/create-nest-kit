import { projectPath } from '../../../generate/relocate.ts';
import type { Layout } from '../../../options.ts';
import type { LayerManifest } from '../../types.ts';

/** The feature modules other than `src/auth/`, in each layout. */
const FEATURE_MODULES_BY_LAYOUT: Record<Layout, string> = {
  nested: 'each folder in `src/modules/`',
  flat: '`src/users/`, `src/roles/`, `src/permissions/` and `src/sessions/`',
};

/**
 * Controllers send commands and queries through `@nestjs/cqrs`'s buses; each has its own handler.
 * Modules use the role folders of the official example. Handlers use the same repositories as
 * services would.
 */
export const cqrsCoreLayer: LayerManifest = {
  id: 'pattern/cqrs/core',
  status: 'ready',
  when: (options) => options.pattern === 'cqrs',
  dependencies: {
    '@nestjs/cqrs': '12.1.2',
  },
  readme: [
    {
      title: 'Commands and queries',
      body: (options) => `
- Controllers only translate HTTP into messages: they send a command (a change) or a query (a read) through \`CommandBus\` or \`QueryBus\` and turn the result into a view.
- Every feature module (\`src/auth/\` and ${FEATURE_MODULES_BY_LAYOUT[options.layout]}) follows the official NestJS CQRS example: only \`<module>.module.ts\` and its controllers sit at the module root. A command lives in \`commands/impl/<operation>.command.ts\`, its handler in \`commands/handlers/\`, and \`commands/handlers/index.ts\` lists the module's \`CommandHandlers\`; queries live under \`queries/\` the same way, with \`QueryHandlers\`.
- Everything else goes into a role folder: \`providers/\` for the repository ports and other injectables (e.g. \`${projectPath('src/modules/users/users.repository.ts', options)}\`), \`models/\` for types, views, exceptions and pure helpers (e.g. \`${projectPath('src/modules/users/user.ts', options)}\`), \`schemas/\` for the request DTOs, \`guards/\` and \`decorators/\`.
- Messages extend \`Command<Result>\` or \`Query<Result>\` from \`@nestjs/cqrs\`, so \`execute()\` returns the handler's result type.
- Handlers use the repository ports directly; a module reaches another module only through the buses. A side effect that must not be skipped, such as revoking sessions when a password changes, is a command the handler awaits, never an event: the \`EventBus\` doesn't wait for its handlers.
- A new handler goes into its folder's \`handlers/index.ts\`; the module registers \`...CommandHandlers\` and \`...QueryHandlers\`. \`CqrsModule.forRoot()\` in \`${projectPath('src/modules/features.module.ts', options)}\` registers the handlers of every module when the app starts.
`,
    },
  ],
};
