import type { LayerManifest } from '../../types.ts';

/**
 * Controllers send commands and queries through `@nestjs/cqrs`'s buses; each has its own handler,
 * one folder per operation. Handlers use the same repositories as services would.
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
      body: `
- Controllers only translate HTTP into messages: they send a command (a change) or a query (a read) through \`CommandBus\` or \`QueryBus\` and turn the result into a view.
- One folder per operation: \`src/modules/<module>/commands/<operation>/\` holds \`<operation>.command.ts\`, its \`<operation>.handler.ts\` and the handler's spec; queries live under \`queries/\` the same way. The \`/auth\` commands are in \`src/auth/commands/\`.
- Messages extend \`Command<Result>\` or \`Query<Result>\` from \`@nestjs/cqrs\`, so \`execute()\` returns the handler's result type.
- Handlers use the repository ports directly; a module reaches another module only through the buses. A side effect that must not be skipped, such as revoking sessions when a password changes, is a command the handler awaits, never an event: the \`EventBus\` doesn't wait for its handlers.
- A new handler goes into its module's \`providers\`. \`CqrsModule.forRoot()\` in \`src/modules/features.module.ts\` registers the handlers of every module when the app starts.
`,
    },
  ],
};
