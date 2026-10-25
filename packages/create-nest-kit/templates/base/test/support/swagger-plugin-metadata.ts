import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PluginMetadataGenerator } from '@nestjs/cli/lib/compiler/plugins/plugin-metadata-generator.js';
import { SwaggerModule } from '@nestjs/swagger';
import { ReadonlyVisitor } from '@nestjs/swagger/plugin';

// `nest build` runs the Swagger CLI plugin (nest-cli.json), which documents DTO classes from
// their types and comments. Tests compile with SWC, which can't run it, so this generates the
// same metadata the way Nest documents for SWC builds and loads it before the docs are built.

const METADATA_FILE = 'metadata.ts';
const SOURCE_DIR = 'src';

/** Gives the app's DTO classes the Swagger metadata `nest build` would. */
export async function loadSwaggerPluginMetadata(): Promise<void> {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'swagger-plugin-metadata-'));
  const sourceDir = path.resolve(SOURCE_DIR);
  // outDir = rootDir makes the metadata import the TypeScript sources rather than dist/.
  const visitor = new ReadonlyVisitor({
    introspectComments: true,
    pathToSource: outputDir,
    outDir: sourceDir,
    rootDir: sourceDir,
  });
  try {
    new PluginMetadataGenerator().generate({
      visitors: [visitor],
      outputDir,
      filename: METADATA_FILE,
      tsconfigPath: 'tsconfig.build.json',
      printDiagnostics: false,
    });
    const metadataModule: unknown = await import(path.join(outputDir, METADATA_FILE));
    await SwaggerModule.loadPluginMetadata(metadataFactoryOf(metadataModule));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

function metadataFactoryOf(metadataModule: unknown): () => Promise<Record<string, unknown>> {
  if (
    typeof metadataModule !== 'object' ||
    metadataModule === null ||
    !('default' in metadataModule) ||
    typeof metadataModule.default !== 'function'
  ) {
    throw new Error(`The generated ${METADATA_FILE} exports no metadata factory`);
  }
  const factory = metadataModule.default;
  return async () => {
    const metadata: unknown = await factory();
    if (typeof metadata !== 'object' || metadata === null) {
      throw new Error(`The generated ${METADATA_FILE} returned no metadata`);
    }
    return { ...metadata };
  };
}
