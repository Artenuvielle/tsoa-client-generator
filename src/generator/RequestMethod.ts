import { factory, MethodDeclaration, SyntaxKind, TypeNode } from 'typescript';
import { RouteMethod } from '../interpreter/RouteMethod';
import { expect } from '../util';
import { Importable } from './Import';

const publicToken = factory.createToken(SyntaxKind.PublicKeyword);
const staticToken = factory.createToken(SyntaxKind.StaticKeyword);

const cancelablePromiseIdentifier = factory.createIdentifier('CancelablePromise');
const openAPIIdentifier = factory.createIdentifier('OpenAPI');
const asRequestIdentifier = factory.createIdentifier('request');
const requestIdentifier = factory.createIdentifier('__request');

export class RequestMethod {
  public requiredImports: Importable[] = [
    { type: 'resolved', identifier: cancelablePromiseIdentifier, path: './core/CancelablePromise' },
    { type: 'resolved', identifier: openAPIIdentifier, path: './core/OpenAPI' },
    {
      type: 'resolved',
      beforeAsIdentifier: asRequestIdentifier,
      identifier: requestIdentifier,
      path: './core/request',
    },
  ];

  constructor(private method: RouteMethod) {
    if (method.bodyParam !== undefined && method.bodyParam.type !== undefined)
      this.requiredImports.push({ type: 'unresolved', node: method.bodyParam.type });
    if (method.declaration.type !== undefined)
      this.requiredImports.push({
        type: 'unresolved',
        node: method.isAsync() ? this.removeAsync(method.declaration.type) : method.declaration.type,
      });
  }

  private removeAsync(type: TypeNode): TypeNode {
    const typeAsReference = expect(type, SyntaxKind.TypeReference);
    const typeName = expect(typeAsReference.typeName, SyntaxKind.Identifier);
    if (typeName.text !== 'Promise' || typeAsReference.typeArguments?.length !== 1) {
      throw new Error('Async function not returning Promise');
    }
    return typeAsReference.typeArguments[0];
  }

  public getDeclaration(): MethodDeclaration {
    const routeParamArray = Object.entries(this.method.routeParams);
    return factory.createMethodDeclaration(
      [publicToken, staticToken],
      undefined,
      this.method.name,
      undefined,
      undefined,
      this.method.bodyParam === undefined && routeParamArray.length === 0
        ? []
        : [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier('data'),
              undefined,
              factory.createTypeLiteralNode([
                ...routeParamArray.map(([parameterName]) =>
                  factory.createPropertySignature(
                    undefined,
                    factory.createIdentifier(parameterName),
                    undefined,
                    factory.createKeywordTypeNode(SyntaxKind.StringKeyword)
                  )
                ),
                ...(this.method.bodyParam === undefined
                  ? []
                  : [
                      factory.createPropertySignature(
                        undefined,
                        factory.createIdentifier('requestBody'),
                        undefined,
                        this.method.bodyParam.type
                      ),
                    ]),
              ]),
              undefined
            ),
          ],
      factory.createTypeReferenceNode(cancelablePromiseIdentifier, [
        this.method.declaration.type ?? factory.createKeywordTypeNode(SyntaxKind.VoidKeyword),
      ]),
      factory.createBlock(
        [
          factory.createReturnStatement(
            factory.createCallExpression(requestIdentifier, undefined, [
              openAPIIdentifier,
              factory.createObjectLiteralExpression(
                [
                  factory.createPropertyAssignment(
                    factory.createIdentifier('method'),
                    factory.createStringLiteral(this.method.method.toUpperCase())
                  ),
                  factory.createPropertyAssignment(
                    factory.createIdentifier('url'),
                    factory.createStringLiteral(
                      '/' +
                        this.method.controller.route +
                        (this.method.route !== undefined ? '/' + this.method.route : '')
                    )
                  ),
                  ...(routeParamArray.length === 0
                    ? []
                    : [
                        factory.createPropertyAssignment(
                          factory.createIdentifier('path'),
                          factory.createObjectLiteralExpression(
                            routeParamArray.map(([parameterName]) =>
                              factory.createPropertyAssignment(
                                factory.createIdentifier(parameterName),
                                factory.createPropertyAccessExpression(
                                  factory.createIdentifier('data'),
                                  factory.createIdentifier(parameterName)
                                )
                              )
                            ),
                            true
                          )
                        ),
                      ]),
                  ...(this.method.bodyParam === undefined
                    ? []
                    : [
                        factory.createPropertyAssignment(
                          factory.createIdentifier('body'),
                          factory.createPropertyAccessExpression(
                            factory.createIdentifier('data'),
                            factory.createIdentifier('requestBody')
                          )
                        ),
                      ]),
                  factory.createPropertyAssignment(
                    factory.createIdentifier('errors'),
                    factory.createObjectLiteralExpression(
                      [
                        factory.createPropertyAssignment(
                          factory.createNumericLiteral('401'),
                          factory.createStringLiteral('Unauthorized')
                        ),
                      ],
                      true
                    )
                  ),
                ],
                true
              ),
            ])
          ),
        ],
        true
      )
    );
  }
}
