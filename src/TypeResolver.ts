import {
  type ExportDeclaration,
  factory,
  type Identifier,
  type SourceFile,
  SyntaxKind,
  type Node,
  type TypeNode,
  NodeArray,
} from 'typescript';
import { ResolvedImportable, UnresolvedImportable } from './generator/Import';
import { SourceFileLoader } from './SourceFileLoader';
import { dirname, join } from 'path';
import { expect, expectIfDefined } from './util';

const knownTSTypeIdentifiers: string[] = [
  'Array',
  'Promise',
  'Date',

  'Awaited',
  'Partial',
  'Required',
  'Readonly',
  'Record',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ConstructorParameters',
  'ReturnType',
  'InstanceType',
  'NoInfer',
  'ThisParameterType',
  'OmitThisParameter',
  'ThisType',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
];

export class TypeResolver {
  constructor(public outputPath: string) {}

  private typeNodesToGenerate: Record<string, Node> = {};

  private sourceFileLoader = SourceFileLoader.get();

  generateTypeNode = (currentSourceFile: SourceFile, name: string, exportOnly = false, isLast = true): boolean => {
    if (this.typeNodesToGenerate[name] !== undefined) return true;

    const foundType = (node: Node, requiredTypeNodes: TypeNode[], typeParameters: string[]): void => {
      console.log('Adding type declaration: ' + name);
      this.typeNodesToGenerate[name] = node;
      requiredTypeNodes.forEach((typeNode) =>
        this.recursiveResolveDataType(currentSourceFile, typeNode, typeParameters)
      );
    };

    const possibleExportStatements: ExportDeclaration[] = [];

    for (const statement of currentSourceFile.statements) {
      switch (statement.kind) {
        case SyntaxKind.ImportDeclaration: {
          const importDeclaration = expect(statement, SyntaxKind.ImportDeclaration);
          if (
            expectIfDefined(importDeclaration.importClause?.namedBindings, SyntaxKind.NamedImports)?.elements?.find(
              (element) => element.name.text === name
            ) !== undefined
          ) {
            return this.generateTypeNode(
              this.sourceFileLoader.load(
                join(
                  dirname(currentSourceFile.fileName),
                  expect(importDeclaration.moduleSpecifier, SyntaxKind.StringLiteral).text
                )
              ),
              name,
              true,
              isLast
            );
          }
          break;
        }
        case SyntaxKind.ExportDeclaration: {
          if (!exportOnly) break;
          const exportDeclaration = expect(statement, SyntaxKind.ExportDeclaration);
          if (exportDeclaration.exportClause === undefined) {
            possibleExportStatements.push(statement as ExportDeclaration);
          } else {
            if (
              expectIfDefined(exportDeclaration.exportClause, SyntaxKind.NamedExports)?.elements?.find(
                (element) => element.name.text === name
              ) !== undefined
            ) {
              return this.generateTypeNode(
                SourceFileLoader.get().load(
                  join(
                    dirname(currentSourceFile.fileName),
                    expect(exportDeclaration.moduleSpecifier!, SyntaxKind.StringLiteral).text
                  )
                ),
                name,
                true,
                isLast
              );
            }
          }
          break;
        }
        case SyntaxKind.TypeAliasDeclaration: {
          const typeAliasDeclaratrion = expect(statement, SyntaxKind.TypeAliasDeclaration);
          if (
            exportOnly &&
            typeAliasDeclaratrion.modifiers?.find((modifier) => modifier.kind === SyntaxKind.ExportKeyword) ===
              undefined
          ) {
            break;
          }
          if (typeAliasDeclaratrion.name.text === name) {
            foundType(
              statement,
              [typeAliasDeclaratrion.type],
              typeAliasDeclaratrion.typeParameters?.map((typeParameter) => typeParameter.name.text) ?? []
            );
            return true;
          }
          break;
        }
        case SyntaxKind.InterfaceDeclaration: {
          const interfaceDeclaration = expect(statement, SyntaxKind.InterfaceDeclaration);
          if (
            exportOnly &&
            interfaceDeclaration.modifiers?.find((modifier) => modifier.kind === SyntaxKind.ExportKeyword) === undefined
          ) {
            break;
          }
          if (interfaceDeclaration.name.text === name) {
            foundType(
              statement,
              [
                ...(interfaceDeclaration.heritageClauses?.flatMap((heritageClause) => heritageClause.types) ?? []),
                ...(interfaceDeclaration.members
                  ?.map((member) => expect(member, SyntaxKind.PropertySignature).type)
                  .filter((e) => e !== undefined) ?? []),
              ],
              interfaceDeclaration.typeParameters?.map((typeParameter) => typeParameter.name.text) ?? []
            );
            return true;
          }
          break;
        }
        case SyntaxKind.EnumDeclaration: {
          const enumDeclaration = expect(statement, SyntaxKind.EnumDeclaration);
          if (
            exportOnly &&
            enumDeclaration.modifiers?.find((modifier) => modifier.kind === SyntaxKind.ExportKeyword) === undefined
          ) {
            break;
          }
          if (enumDeclaration.name.text === name) {
            foundType(statement, [], []);
            return true;
          }
          break;
        }
      }
    }
    for (const exportStatement of possibleExportStatements) {
      if (
        this.generateTypeNode(
          this.sourceFileLoader.load(
            join(
              dirname(currentSourceFile.fileName),
              expect(exportStatement.moduleSpecifier!, SyntaxKind.StringLiteral).text
            )
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
    const traverseArray = (ts: NodeArray<TypeNode> | Array<TypeNode>): ResolvedImportable[] => {
      const result: ResolvedImportable[] = [];
      ts.forEach((t) => result.push(...this.recursiveResolveDataType(currentSourceFile, t, typeParameters)));
      return result;
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
      case SyntaxKind.TypeLiteral: {
        return traverseArray(
          expect(type, SyntaxKind.TypeLiteral)
            .members.map((element) => expect(element, SyntaxKind.PropertySignature).type)
            .filter((e) => e !== undefined)
        );
      }
      case SyntaxKind.BooleanKeyword:
      case SyntaxKind.NumberKeyword:
      case SyntaxKind.StringKeyword:
      case SyntaxKind.LiteralType:
        return [];
      default:
        throw Error('Unhandled type resolve kind: ' + type.kind);
    }
    throw Error('Forgot to return upon resolving kind: ' + type.kind);
  }

  getNodeArray(): NodeArray<Node> {
    return factory.createNodeArray(Object.entries(this.typeNodesToGenerate).map(([_, node]) => node));
  }
}
