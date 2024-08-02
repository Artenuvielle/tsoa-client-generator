import { ClassDeclaration, factory, SyntaxKind } from 'typescript';
import { Controller } from '../interpreter/Controller';
import { RequestMethod } from './RequestMethod';

export class Service {
  public requestMethods: RequestMethod[];
  constructor(private controller: Controller) {
    this.requestMethods = this.controller.routeMethods.map((routeMethod) => new RequestMethod(routeMethod));
  }

  public getDeclaration(): ClassDeclaration {
    return factory.createClassDeclaration(
      [factory.createToken(SyntaxKind.ExportKeyword)],
      this.controller.name.substring(0, this.controller.name.length - 'Controller'.length) + 'Service',
      undefined,
      undefined,
      this.requestMethods.map((requestMethod) => requestMethod.getDeclaration())
    );
  }
}
