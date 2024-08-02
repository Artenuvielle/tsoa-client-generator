import { ClassDeclaration, ExpressionWithTypeArguments, Identifier, SyntaxKind } from 'typescript';
import { findByKind, readAnnotations } from '../util';
import { RouteMethod } from './RouteMethod';

export class Controller {
  public name: string;
  public route: string;
  public routeMethods: RouteMethod[] = [];

  constructor(public declaration: ClassDeclaration) {
    if (declaration.name === undefined) this.throwInvalidController();
    if (
      declaration.heritageClauses?.find(
        (heritageClause) =>
          heritageClause.token === SyntaxKind.ExtendsKeyword &&
          heritageClause.types.find(
            (type) =>
              type.kind === SyntaxKind.ExpressionWithTypeArguments &&
              ((type as ExpressionWithTypeArguments).expression as Identifier).text === 'Controller'
          ) !== undefined
      ) === undefined
    )
      this.throwInvalidController();
    this.name = declaration.name!.text;
    const annotations = readAnnotations(declaration);
    const routeAnnotations = annotations
      .filter((annotation) => annotation.name === 'Route')
      .map((annotation) => {
        if (annotation.arguments.length !== 1) this.throwInvalidController();
        return annotation.arguments[0];
      });
    if (routeAnnotations.length !== 1) this.throwInvalidController();
    this.route = routeAnnotations[0];

    findByKind(declaration.members, SyntaxKind.MethodDeclaration).forEach((methodDeclaration) => {
      try {
        const readRoutMethod = new RouteMethod(this, methodDeclaration);
        this.routeMethods.push(readRoutMethod);
      } catch (e) {
        console.log(e);
      }
    });
  }

  private throwInvalidController() {
    throw Error('Reading invalid controller class');
  }
}
