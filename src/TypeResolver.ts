import {
  type ExportDeclaration,
  factory,
  type Identifier,
  type ImportDeclaration,
  type InterfaceDeclaration,
  type NamedExports,
  type NamedImports,
  type SourceFile,
  type StringLiteral,
  SyntaxKind,
  type TypeAliasDeclaration,
  type Node,
  type TypeNode,
  type PropertySignature,
  type EnumDeclaration,
  NodeArray,
} from 'typescript';
import { ResolvedImportable, UnresolvedImportable } from './generator/Import';
import { SourceFileLoader } from './SourceFileLoader';
import { dirname, join } from 'path';
import { expect } from './util';

const knownTSTypeIdentifiers: string[] = ['Array', 'Omit', 'Partial', 'Pick', 'Promise', 'Date'];

export class TypeResolver {
  constructor(public outputPath: string) {}

  private typeNodesToGenerate: Record<string, Node> = {};

  private sourceFileLoader = SourceFileLoader.get();

  generateTypeNode = (currentSourceFile: SourceFile, name: string, exportOnly = false, isLast = true): boolean => {
    if (this.typeNodesToGenerate[name] !== undefined) return true;

    const foundType = (node: Node, requiredTypeNodes: TypeNode[], typeParameters: string[]): void => {
      console.log('Adding import type: ' + name);
      this.typeNodesToGenerate[name] = node;
      requiredTypeNodes.forEach((typeNode) =>
        this.recursiveResolveDataType(currentSourceFile, typeNode, typeParameters)
      );
    };

    const possibleExportStatements: ExportDeclaration[] = [];

    for (const statement of currentSourceFile.statements) {
      switch (statement.kind) {
        case SyntaxKind.ImportDeclaration:
          if (
            ((statement as ImportDeclaration).importClause?.namedBindings as NamedImports | undefined)?.elements?.find(
              (element) => element.name.text === name
            ) !== undefined
          ) {
            return this.generateTypeNode(
              this.sourceFileLoader.load(
                join(
                  dirname(currentSourceFile.fileName),
                  ((statement as ImportDeclaration).moduleSpecifier as StringLiteral).text
                )
              ),
              name,
              true,
              isLast
            );
          }
          break;
        case SyntaxKind.ExportDeclaration:
          if (!exportOnly) break;
          if ((statement as ExportDeclaration).exportClause === undefined) {
            possibleExportStatements.push(statement as ExportDeclaration);
          } else {
            if (
              ((statement as ExportDeclaration).exportClause as NamedExports)?.elements?.find(
                (element) => element.name.text === name
              ) !== undefined
            ) {
              return this.generateTypeNode(
                SourceFileLoader.get().load(
                  join(
                    dirname(currentSourceFile.fileName),
                    ((statement as ExportDeclaration).moduleSpecifier as StringLiteral).text
                  )
                ),
                name,
                true,
                isLast
              );
            }
          }
          break;
        case SyntaxKind.TypeAliasDeclaration:
          if (
            exportOnly &&
            (statement as TypeAliasDeclaration).modifiers?.find(
              (modifier) => modifier.kind === SyntaxKind.ExportKeyword
            ) === undefined
          ) {
            break;
          }
          if ((statement as TypeAliasDeclaration).name.text === name) {
            foundType(
              statement,
              [(statement as TypeAliasDeclaration).type],
              (statement as TypeAliasDeclaration).typeParameters?.map((typeParameter) => typeParameter.name.text) ?? []
            );
            return true;
          }
          break;
        case SyntaxKind.InterfaceDeclaration:
          if (
            exportOnly &&
            (statement as InterfaceDeclaration).modifiers?.find(
              (modifier) => modifier.kind === SyntaxKind.ExportKeyword
            ) === undefined
          ) {
            break;
          }
          if ((statement as InterfaceDeclaration).name.text === name) {
            foundType(
              statement,
              [
                ...((statement as InterfaceDeclaration).heritageClauses?.flatMap(
                  (heritageClause) => heritageClause.types
                ) ?? []),
                ...((statement as InterfaceDeclaration).members
                  ?.map((member) => (member as PropertySignature).type)
                  .filter((e) => e !== undefined) ?? []),
              ],
              (statement as InterfaceDeclaration).typeParameters?.map((typeParameter) => typeParameter.name.text) ?? []
            );
            return true;
          }
          break;
        case SyntaxKind.EnumDeclaration:
          if (
            exportOnly &&
            (statement as EnumDeclaration).modifiers?.find((modifier) => modifier.kind === SyntaxKind.ExportKeyword) ===
              undefined
          ) {
            break;
          }
          if ((statement as EnumDeclaration).name.text === name) {
            foundType(statement, [], []);
            return true;
          }
          break;
      }
    }
    for (const exportStatement of possibleExportStatements) {
      if (
        this.generateTypeNode(
          this.sourceFileLoader.load(
            join(dirname(currentSourceFile.fileName), (exportStatement.moduleSpecifier as StringLiteral).text)
          ),
          name,
          true,
          isLast && exportStatement === possibleExportStatements[possibleExportStatements.length - 1]
        )
      ) {
        return true;
      }
    }
    if (isLast) throw new Error('Could not find declaration of ' + name);
    return false;
  };

  public resolve(currentSourceFile: SourceFile, unresolvedImport: UnresolvedImportable): ResolvedImportable[] {
    return this.recursiveResolveDataType(currentSourceFile, unresolvedImport.node);
  }

  private createResolvedImportable(identifier: Identifier): ResolvedImportable {
    return {
      type: 'resolved',
      identifier: identifier,
      path: this.outputPath,
    };
  }

  private recursiveResolveDataType(
    currentSourceFile: SourceFile,
    type: TypeNode,
    typeParameters: string[] = []
  ): ResolvedImportable[] {
    const traverseSingle = (t: TypeNode): ResolvedImportable[] => {
      return this.recursiveResolveDataType(currentSourceFile, t, typeParameters);
    };
    const traverseArray = (ts: NodeArray<TypeNode>): ResolvedImportable[] => {
      return ts.reduce(
        (acc, t) => acc.concat(...this.recursiveResolveDataType(currentSourceFile, t, typeParameters)),
        [] as ResolvedImportable[]
      );
    };
    switch (type.kind) {
      case SyntaxKind.TypeReference: {
        const typeReferenceNode = expect(type, SyntaxKind.TypeReference);
        const identifier = expect(typeReferenceNode.typeName, SyntaxKind.Identifier);
        const results: ResolvedImportable[] = [];
        if (!knownTSTypeIdentifiers.includes(identifier.text) && !typeParameters.includes(identifier.text)) {
          this.generateTypeNode(currentSourceFile, identifier.text);
          results.push(this.createResolvedImportable(identifier));
        }
        typeReferenceNode.typeArguments?.forEach((t) =>
          results.push(...this.recursiveResolveDataType(currentSourceFile, t, typeParameters))
        );
        return results;
      }
      case SyntaxKind.ArrayType: {
        return traverseSingle(expect(type, SyntaxKind.ArrayType).elementType);
      }
      case SyntaxKind.ParenthesizedType: {
        return traverseSingle(expect(type, SyntaxKind.ParenthesizedType).type);
      }
      case SyntaxKind.TypeOperator: {
        return traverseSingle(expect(type, SyntaxKind.TypeOperator).type);
      }
      case SyntaxKind.ExpressionWithTypeArguments: {
        const expressionWithTypeArgumentsNode = expect(type, SyntaxKind.ExpressionWithTypeArguments);
        const identifier = expect(expressionWithTypeArgumentsNode.expression, SyntaxKind.Identifier);
        const results: ResolvedImportable[] = [];
        if (!knownTSTypeIdentifiers.includes(identifier.text) && !typeParameters.includes(identifier.text)) {
          this.generateTypeNode(currentSourceFile, identifier.text);
          results.push(this.createResolvedImportable(identifier));
        }
        expressionWithTypeArgumentsNode.typeArguments?.forEach((t) =>
          results.push(...this.recursiveResolveDataType(currentSourceFile, t, typeParameters))
        );
        return results;
      }
      case SyntaxKind.UnionType: {
        return traverseArray(expect(type, SyntaxKind.UnionType).types);
      }
      case SyntaxKind.IntersectionType: {
        return traverseArray(expect(type, SyntaxKind.IntersectionType).types);
      }
      case SyntaxKind.BooleanKeyword:
      case SyntaxKind.NumberKeyword:
      case SyntaxKind.StringKeyword:
      case SyntaxKind.TypeLiteral:
      case SyntaxKind.LiteralType:
        return [];
      default:
        throw Error('Unhandled type resolve kind: ' + type.kind);
    }
    throw Error('Forgot to return upon resolving kind: ' + type.kind);
  }

  getNodeArray(): NodeArray<Node> {
    return factory.createNodeArray(Object.entries(this.typeNodesToGenerate).map(([_name, node]) => node));
  }
}
