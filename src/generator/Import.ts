import { factory, Identifier, ImportDeclaration, TypeNode } from 'typescript';

export interface ResolvedImportable {
  type: 'resolved';
  beforeAsIdentifier?: Identifier;
  identifier: Identifier;
  path: string;
}
export interface UnresolvedImportable {
  type: 'unresolved';
  node: TypeNode;
}

export type Importable = ResolvedImportable | UnresolvedImportable;

const equalsResolve = (a: ResolvedImportable): ((b: ResolvedImportable) => boolean) => {
  const aName = a.beforeAsIdentifier?.text ?? a.identifier.text;
  return (b: ResolvedImportable): boolean => {
    const bName = b.beforeAsIdentifier?.text ?? b.identifier.text;
    if (aName === bName) {
      if (a.beforeAsIdentifier?.text !== b.beforeAsIdentifier?.text) {
        throw Error('Cannot import same identifer as alias and without alias.');
      }
      return true;
    }
    return false;
  };
};

export class Import {
  private resolvedImportablesByPathAndIdentifier: Record<string, ResolvedImportable[]> = {};

  constructor(resolvedImportables: ResolvedImportable[]) {
    resolvedImportables.forEach((resolvedImportable) => {
      if (this.resolvedImportablesByPathAndIdentifier[resolvedImportable.path] === undefined) {
        this.resolvedImportablesByPathAndIdentifier[resolvedImportable.path] = [resolvedImportable];
      } else {
        const localEqualsResolve = equalsResolve(resolvedImportable);
        if (
          this.resolvedImportablesByPathAndIdentifier[resolvedImportable.path].find(localEqualsResolve) === undefined
        ) {
          this.resolvedImportablesByPathAndIdentifier[resolvedImportable.path].push(resolvedImportable);
        }
      }
    });
  }

  public getDeclarations(): ImportDeclaration[] {
    return Object.entries(this.resolvedImportablesByPathAndIdentifier).map(([path, resolvedImportables]) =>
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamedImports(
            resolvedImportables.map((resolvedImportable) =>
              factory.createImportSpecifier(false, resolvedImportable.beforeAsIdentifier, resolvedImportable.identifier)
            )
          )
        ),
        factory.createStringLiteral(path),
        undefined
      )
    );
  }
}
