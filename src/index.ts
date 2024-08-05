import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  type ClassDeclaration,
  createPrinter,
  createSourceFile,
  factory,
  ListFormat,
  NewLineKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';
import { SourceFileLoader } from './SourceFileLoader';
import { findByKind } from './util';
import { Controller } from './interpreter/Controller';
import { Service } from './generator/Service';
import { Import, ResolvedImportable } from './generator/Import';
import { TypeResolver } from './TypeResolver';
import { createClient } from '@hey-api/openapi-ts';

export interface ClientGeneratorConfig {
  //entryFile?: string;
  controllerPathGlobs: string[];
  clientDirectory: string;
  client: '@hey-api/client-axios' | '@hey-api/client-fetch' | 'angular' | 'axios' | 'fetch' | 'node' | 'xhr';
}

export const generateClient = async (options: ClientGeneratorConfig): Promise<void> => {
  console.log('Running client generation');
  const destDir = options.clientDirectory;
  await createClient({
    client: options.client,
    input: join(__dirname, '..', 'openapi.yaml'),
    output: destDir,
  });

  const sourceFileLoader = SourceFileLoader.get();
  const typeResolver = new TypeResolver('./types.gen');

  const classDeclarations: ClassDeclaration[] = [];
  const resolvedImportables: ResolvedImportable[] = [];

  sourceFileLoader.loadByGlobs(options.controllerPathGlobs).forEach((sourceFile) => {
    findByKind(sourceFile.statements, SyntaxKind.ClassDeclaration).forEach((controllerClassDeclaration) => {
      const controller = new Controller(controllerClassDeclaration);
      const service = new Service(controller);
      classDeclarations.push(service.getDeclaration());
      service.requestMethods.forEach((requestMethod) => {
        requestMethod.requiredImports.forEach((requiredImport) => {
          if (requiredImport.type === 'resolved') {
            resolvedImportables.push(requiredImport);
          } else {
            resolvedImportables.push(...typeResolver.resolve(sourceFile, requiredImport));
          }
        });
      });
    });
  });

  const printer = createPrinter({ newLine: NewLineKind.LineFeed });
  const servicesFile = createSourceFile(
    join(destDir, 'services.gen.ts'),
    '',
    ScriptTarget.Latest,
    false,
    ScriptKind.TS
  );
  const typesFile = createSourceFile(join(destDir, 'types.gen.ts'), '', ScriptTarget.Latest, false, ScriptKind.TS);

  writeFileSync(
    join(destDir, 'services.gen.ts'),
    printer.printList(
      ListFormat.MultiLine,
      factory.createNodeArray([...new Import(resolvedImportables).getDeclarations(), ...classDeclarations]),
      servicesFile
    )
  );

  writeFileSync(
    join(destDir, 'types.gen.ts'),
    printer.printList(ListFormat.MultiLine, typeResolver.getNodeArray(), typesFile)
  );
  console.log('Client generation finished');
};
