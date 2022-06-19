import { SingleUnionType, TypeReference } from "@fern-api/api";
import {
    FernWriters,
    getNamedTypeReference,
    getTextOfTsNode,
    getTypeReference,
    getWriterForMultiLineUnionType,
    maybeAddDocs,
    SourceFileManager,
    TypeResolver,
    visitorUtils,
} from "@fern-typescript/commons";
import {
    Directory,
    InterfaceDeclaration,
    InterfaceDeclarationStructure,
    OptionalKind,
    ts,
    VariableDeclarationKind,
    WriterFunction,
} from "ts-morph";
import { getKeyForUnion, getResolvedTypeForSingleUnionType, ResolvedSingleUnionType } from "./utils";

interface SingleUnionTypeWithResolvedValueType {
    originalType: SingleUnionType;
    resolvedType: ResolvedSingleUnionType | undefined;
}

export declare namespace generateUnionType {
    export interface ObjectProperty {
        key: string;
        valueType: TypeReference;
        generateValueCreator: (args: { file: SourceFileManager }) => ts.Expression;
    }
}

export function generateUnionType({
    file,
    typeName,
    docs,
    discriminant,
    types,
    additionalPropertiesForEveryType = [],
    typeResolver,
    modelDirectory,
    baseDirectory,
    baseDirectoryType,
}: {
    file: SourceFileManager;
    typeName: string;
    docs: string | null | undefined;
    discriminant: string;
    types: SingleUnionType[];
    additionalPropertiesForEveryType?: generateUnionType.ObjectProperty[];
    typeResolver: TypeResolver;
    modelDirectory: Directory;
    baseDirectory: Directory;
    baseDirectoryType: getNamedTypeReference.Args["baseDirectoryType"];
}): void {
    const resolvedTypes: SingleUnionTypeWithResolvedValueType[] = types.map((type) => ({
        originalType: type,
        resolvedType: getResolvedTypeForSingleUnionType({
            singleUnionType: type,
            typeResolver,
            baseDirectory,
            baseDirectoryType,
            file,
        }),
    }));
    const typeAlias = file.file.addTypeAlias({
        name: typeName,
        type: getWriterForMultiLineUnionType(
            types.map((type) => ({
                node: ts.factory.createTypeReferenceNode(
                    ts.factory.createQualifiedName(
                        ts.factory.createIdentifier(typeName),
                        ts.factory.createIdentifier(getKeyForUnion(type))
                    ),
                    undefined
                ),
                docs: type.docs,
            }))
        ),
        isExported: true,
    });
    maybeAddDocs(typeAlias, docs);

    const module = file.file.addModule({
        name: typeName,
        isExported: true,
        hasDeclareKeyword: true,
    });

    for (const { resolvedType, originalType } of resolvedTypes) {
        const interfaceNode = module.addInterface(
            generateDiscriminatedSingleUnionTypeInterface({ discriminant, singleUnionType: originalType })
        );

        for (const additionalProperty of additionalPropertiesForEveryType) {
            interfaceNode.addProperty({
                name: additionalProperty.key,
                type: getTextOfTsNode(
                    getTypeReference({
                        reference: additionalProperty.valueType,
                        referencedIn: file,
                        baseDirectory: modelDirectory,
                        baseDirectoryType: "model",
                    })
                ),
            });
        }

        if (resolvedType != null) {
            if (resolvedType.isExtendable) {
                interfaceNode.addExtends(getTextOfTsNode(resolvedType.type));
            } else {
                addNonExtendableProperty(interfaceNode, originalType, resolvedType.type);
            }
        }
    }

    const visitorItems: visitorUtils.VisitableItem[] = resolvedTypes.map(({ resolvedType, originalType }) => {
        return {
            caseInSwitchStatement: ts.factory.createStringLiteral(originalType.discriminantValue),
            keyInVisitor: originalType.discriminantValue,
            visitorArgument:
                resolvedType != null
                    ? resolvedType.isExtendable
                        ? {
                              type: resolvedType.type,
                              argument: ts.factory.createIdentifier(visitorUtils.VALUE_PARAMETER_NAME),
                          }
                        : {
                              type: resolvedType.type,
                              argument: ts.factory.createPropertyAccessExpression(
                                  ts.factory.createIdentifier(visitorUtils.VALUE_PARAMETER_NAME),
                                  ts.factory.createIdentifier(originalType.discriminantValue)
                              ),
                          }
                    : undefined,
        };
    });

    module.addInterface(visitorUtils.generateVisitorInterface(visitorItems));

    file.file.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
            {
                name: typeName,
                initializer: createUtils({
                    typeName,
                    types: resolvedTypes,
                    discriminant,
                    visitorItems,
                    additionalPropertiesForEveryType,
                    file,
                }),
            },
        ],
        isExported: true,
    });
}

function generateDiscriminatedSingleUnionTypeInterface({
    discriminant,
    singleUnionType,
}: {
    discriminant: string;
    singleUnionType: SingleUnionType;
}): OptionalKind<InterfaceDeclarationStructure> {
    return {
        name: getKeyForUnion(singleUnionType),
        properties: [
            {
                name: discriminant,
                type: getTextOfTsNode(ts.factory.createStringLiteral(singleUnionType.discriminantValue)),
            },
        ],
    };
}

function addNonExtendableProperty(
    interfaceNode: InterfaceDeclaration,
    singleUnionType: SingleUnionType,
    resolvedValueType: ts.Node
) {
    interfaceNode.addProperty({
        name: singleUnionType.discriminantValue,
        type: getTextOfTsNode(resolvedValueType),
    });
}

function createUtils({
    typeName,
    types,
    visitorItems,
    additionalPropertiesForEveryType,
    discriminant,
    file,
}: {
    typeName: string;
    types: SingleUnionTypeWithResolvedValueType[];
    visitorItems: readonly visitorUtils.VisitableItem[];
    additionalPropertiesForEveryType: generateUnionType.ObjectProperty[];
    discriminant: string;
    file: SourceFileManager;
}): WriterFunction {
    const writer = FernWriters.object.writer({ asConst: true });

    for (const singleUnionType of types) {
        writer.addProperty({
            key: singleUnionType.originalType.discriminantValue,
            value: getTextOfTsNode(
                generateCreator({
                    typeName,
                    singleUnionType,
                    discriminant,
                    additionalPropertiesForEveryType,
                    file,
                })
            ),
        });
        writer.addNewLine();
    }

    writer.addProperty({
        key: visitorUtils.VISIT_PROPERTY_NAME,
        value: getTextOfTsNode(
            visitorUtils.generateVisitMethod({
                typeName,
                switchOn: ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(visitorUtils.VALUE_PARAMETER_NAME),
                    ts.factory.createIdentifier(discriminant)
                ),
                items: visitorItems,
            })
        ),
    });

    writer.addNewLine();

    writer.addProperty({
        key: "_types",
        value: getTextOfTsNode(
            ts.factory.createArrowFunction(
                undefined,
                undefined,
                [],
                ts.factory.createArrayTypeNode(
                    ts.factory.createIndexedAccessTypeNode(
                        ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(typeName), undefined),
                        ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(discriminant))
                    )
                ),
                undefined,
                ts.factory.createArrayLiteralExpression(
                    types.map(({ originalType }) => ts.factory.createStringLiteral(originalType.discriminantValue))
                )
            )
        ),
    });

    return writer.toFunction();
}

function generateCreator({
    typeName,
    discriminant,
    singleUnionType,
    additionalPropertiesForEveryType,
    file,
}: {
    typeName: string;
    discriminant: string;
    singleUnionType: SingleUnionTypeWithResolvedValueType;
    additionalPropertiesForEveryType: generateUnionType.ObjectProperty[];
    file: SourceFileManager;
}): ts.ArrowFunction {
    const VALUE_PARAMETER_NAME = "value";

    const parameterType = singleUnionType.resolvedType;
    const parameter =
        parameterType != null
            ? ts.factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  undefined,
                  VALUE_PARAMETER_NAME,
                  undefined,
                  parameterType.type,
                  undefined
              )
            : undefined;

    const maybeValueAssignment =
        parameterType != null
            ? parameterType.isExtendable
                ? [ts.factory.createSpreadAssignment(ts.factory.createIdentifier(VALUE_PARAMETER_NAME))]
                : [
                      ts.factory.createPropertyAssignment(
                          ts.factory.createIdentifier(singleUnionType.originalType.discriminantValue),
                          ts.factory.createIdentifier(VALUE_PARAMETER_NAME)
                      ),
                  ]
            : [];

    return ts.factory.createArrowFunction(
        undefined,
        undefined,
        parameter != null ? [parameter] : [],
        getQualifiedUnionTypeReference({ typeName, singleUnionType: singleUnionType.originalType }),
        undefined,
        ts.factory.createParenthesizedExpression(
            ts.factory.createObjectLiteralExpression(
                [
                    ...maybeValueAssignment,
                    ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier(discriminant),
                        ts.factory.createStringLiteral(singleUnionType.originalType.discriminantValue)
                    ),
                    ...additionalPropertiesForEveryType.map((additionalProperty) =>
                        ts.factory.createPropertyAssignment(
                            ts.factory.createIdentifier(additionalProperty.key),
                            additionalProperty.generateValueCreator({ file })
                        )
                    ),
                ],
                true
            )
        )
    );
}

function getQualifiedUnionTypeReference({
    typeName,
    singleUnionType,
}: {
    typeName: string;
    singleUnionType: SingleUnionType;
}) {
    return ts.factory.createTypeReferenceNode(
        ts.factory.createQualifiedName(
            ts.factory.createIdentifier(typeName),
            ts.factory.createIdentifier(getKeyForUnion(singleUnionType))
        ),
        undefined
    );
}
