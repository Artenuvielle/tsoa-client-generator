import {
  type NodeArray,
  type Node,
  ClassDeclaration,
  HasModifiers,
  SyntaxKind,
  Decorator,
  CallExpression,
  Identifier,
  StringLiteral,
  MethodDeclaration,
  TypeReferenceNode,
  ArrayTypeNode,
  ParenthesizedTypeNode,
  TypeOperatorNode,
  ExpressionWithTypeArguments,
  UnionTypeNode,
  IntersectionTypeNode,
  ImportDeclaration,
  NamedImports,
  ExportDeclaration,
  NamedExports,
  TypeAliasDeclaration,
  InterfaceDeclaration,
  PropertySignature,
  EnumDeclaration,
} from 'typescript';

type KindMappdings = {
  [SyntaxKind.ArrayType]: ArrayTypeNode;
  [SyntaxKind.CallExpression]: CallExpression;
  [SyntaxKind.ClassDeclaration]: ClassDeclaration;
  [SyntaxKind.EnumDeclaration]: EnumDeclaration;
  [SyntaxKind.ExportDeclaration]: ExportDeclaration;
  [SyntaxKind.ExpressionWithTypeArguments]: ExpressionWithTypeArguments;
  [SyntaxKind.Decorator]: Decorator;
  [SyntaxKind.Identifier]: Identifier;
  [SyntaxKind.ImportDeclaration]: ImportDeclaration;
  [SyntaxKind.InterfaceDeclaration]: InterfaceDeclaration;
  [SyntaxKind.IntersectionType]: IntersectionTypeNode;
  [SyntaxKind.MethodDeclaration]: MethodDeclaration;
  [SyntaxKind.NamedExports]: NamedExports;
  [SyntaxKind.NamedImports]: NamedImports;
  [SyntaxKind.ParenthesizedType]: ParenthesizedTypeNode;
  [SyntaxKind.PropertySignature]: PropertySignature;
  [SyntaxKind.StringLiteral]: StringLiteral;
  [SyntaxKind.TypeAliasDeclaration]: TypeAliasDeclaration;
  [SyntaxKind.TypeOperator]: TypeOperatorNode;
  [SyntaxKind.TypeReference]: TypeReferenceNode;
  [SyntaxKind.UnionType]: UnionTypeNode;
};

export const findByKind = <K extends keyof KindMappdings>(
  nodeList: NodeArray<Node>,
  kind: K
): Array<KindMappdings[K]> => {
  return nodeList.filter((node) => node.kind === kind) as Array<KindMappdings[K]>;
};

export const expect = <K extends keyof KindMappdings>(node: Node, kind: K): KindMappdings[K] => {
  if (node.kind !== kind) throw new Error('Expected kind ' + kind + ' but got ' + node.kind);
  return node as KindMappdings[K];
};

export const expectIfDefined = <K extends keyof KindMappdings>(
  node: Node | undefined,
  kind: K
): KindMappdings[K] | undefined => {
  if (node === undefined) return undefined;
  return expect(node, kind);
};

export interface AnnotationData {
  name: string;
  arguments: string[];
}

export const readAnnotations = (annotatable: HasModifiers): AnnotationData[] => {
  if (annotatable.modifiers === undefined) return [];
  return findByKind(annotatable.modifiers, SyntaxKind.Decorator)
    .map((decorator) => {
      if (decorator.expression.kind !== SyntaxKind.CallExpression) return undefined;
      const callExpression = expect(decorator.expression, SyntaxKind.CallExpression);
      return {
        name: expect(callExpression.expression, SyntaxKind.Identifier).text,
        arguments: callExpression.arguments.map((arg) => expect(arg, SyntaxKind.StringLiteral).text),
      };
    })
    .filter((e) => e != undefined);
};
