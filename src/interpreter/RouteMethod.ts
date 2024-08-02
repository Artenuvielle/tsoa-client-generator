import { MethodDeclaration, ParameterDeclaration, SyntaxKind } from 'typescript';
import { expect, readAnnotations } from '../util';
import { Controller } from './Controller';

enum RestMethod {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Delete = 'DELETE',
}
const REST_METHODS = [RestMethod.Get, RestMethod.Post, RestMethod.Put, RestMethod.Delete];

export class RouteMethod {
  public name: string;
  public method: RestMethod;
  public route?: string;
  public bodyParam?: ParameterDeclaration;
  public routeParams: Record<string, ParameterDeclaration> = {};

  constructor(public controller: Controller, public declaration: MethodDeclaration) {
    this.name = expect(declaration.name, SyntaxKind.Identifier).text;

    const annotations = readAnnotations(declaration);
    const restAnnotationCandidates = annotations.filter(
      (annotation) =>
        REST_METHODS.find((method) => method.toLowerCase() === annotation.name.toLowerCase()) !== undefined
    );
    if (restAnnotationCandidates.length !== 1) this.throwInvalidRoutMethod();
    this.method = REST_METHODS.find(
      (method) => method.toLowerCase() === restAnnotationCandidates[0].name.toLowerCase()
    )!;
    this.route =
      restAnnotationCandidates[0].arguments.length === 1 ? restAnnotationCandidates[0].arguments[0] : undefined;

    this.bodyParam = declaration.parameters.find((parameter) => {
      const parameterAnnotations = readAnnotations(parameter);
      return parameterAnnotations.find((annotation) => annotation.name === 'Body') !== undefined;
    });

    if (this.route !== undefined) {
      const routeParamNameIterator = this.route?.matchAll(/\{[^}]\}/g);
      let next = routeParamNameIterator.next();
      while (next.done !== true) {
        if (next.value.length !== 2) this.throwInvalidRoutMethod();
        const routeParamName = next.value[1];
        const routeParamAST = declaration.parameters.find((parameter) => parameter.name.getText() === routeParamName);
        if (routeParamAST === undefined) this.throwInvalidRoutMethod();
        else this.routeParams[routeParamName] = routeParamAST;
        next = routeParamNameIterator.next();
      }
    }
  }

  private throwInvalidRoutMethod() {
    throw Error('Reading invalid route method');
  }

  isAsync(): boolean {
    return this.declaration.modifiers?.find((modifier) => modifier.kind === SyntaxKind.AsyncKeyword) !== undefined;
  }
}
