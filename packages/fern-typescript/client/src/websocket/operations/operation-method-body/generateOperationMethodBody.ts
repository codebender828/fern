import { WebSocketOperation } from "@fern-api/api";
import { DependencyManager, generateUuidCall, getTextOfTsNode, ModelContext } from "@fern-typescript/commons";
import {
    GeneratedWebSocketOperationTypes,
    getServiceTypeReference,
    ServiceTypesConstants,
} from "@fern-typescript/service-types";
import { Directory, SourceFile, StatementStructures, ts, WriterFunction } from "ts-morph";
import { ClientConstants } from "../../../constants";

const SOCKET_LOCAL_VARIABLE_NAME = "socket";
const MESSAGE_LOCAL_VARIABLE_NAME = "message";

export function generateOperationMethodBody({
    operation,
    operationTypes,
    channelFile,
    dependencyManager,
    modelDirectory,
    modelContext,
}: {
    operation: WebSocketOperation;
    operationTypes: GeneratedWebSocketOperationTypes;
    channelFile: SourceFile;
    dependencyManager: DependencyManager;
    modelDirectory: Directory;
    modelContext: ModelContext;
}): (StatementStructures | WriterFunction | string)[] {
    return [
        (writer) => {
            writer.writeLine(
                getTextOfTsNode(
                    ts.factory.createVariableStatement(
                        undefined,
                        ts.factory.createVariableDeclarationList(
                            [
                                ts.factory.createVariableDeclaration(
                                    ts.factory.createIdentifier(SOCKET_LOCAL_VARIABLE_NAME),
                                    undefined,
                                    undefined,
                                    ts.factory.createAwaitExpression(
                                        ts.factory.createPropertyAccessExpression(
                                            ts.factory.createThis(),
                                            ts.factory.createIdentifier(
                                                ClientConstants.WebsocketChannel.PrivateMembers.SOCKET
                                            )
                                        )
                                    )
                                ),
                            ],
                            ts.NodeFlags.Const |
                                ts.NodeFlags.AwaitContext |
                                ts.NodeFlags.ContextFlags |
                                ts.NodeFlags.TypeExcludesFlags
                        )
                    )
                )
            );

            writer.newLine();
        },
        getTextOfTsNode(
            ts.factory.createReturnStatement(
                ts.factory.createNewExpression(ts.factory.createIdentifier("Promise"), undefined, [
                    ts.factory.createArrowFunction(
                        undefined,
                        undefined,
                        [
                            ts.factory.createParameterDeclaration(
                                undefined,
                                undefined,
                                undefined,
                                ts.factory.createIdentifier("resolve"),
                                undefined,
                                undefined,
                                undefined
                            ),
                        ],
                        undefined,
                        ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                        ts.factory.createBlock(
                            generatePromiseBody({
                                operation,
                                channelFile,
                                operationTypes,
                                dependencyManager,
                                modelDirectory,
                                modelContext,
                            }),
                            true
                        )
                    ),
                ])
            )
        ),
    ];
}

function generatePromiseBody({
    operation,
    channelFile,
    operationTypes,
    dependencyManager,
    modelDirectory,
    modelContext,
}: {
    operation: WebSocketOperation;
    channelFile: SourceFile;
    operationTypes: GeneratedWebSocketOperationTypes;
    dependencyManager: DependencyManager;
    modelDirectory: Directory;
    modelContext: ModelContext;
}): ts.Statement[] {
    const messageElements: ts.ObjectLiteralElementLike[] = [
        ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier(ServiceTypesConstants.WebsocketChannel.Request.Properties.ID),
            generateUuidCall({ file: channelFile, dependencyManager })
        ),
        ts.factory.createPropertyAssignment(
            ts.factory.createIdentifier(ServiceTypesConstants.WebsocketChannel.Request.Properties.OPERATION),
            ts.factory.createStringLiteral(operation.operationId)
        ),
    ];
    if (operationTypes.request?.body != null) {
        messageElements.push(
            ts.factory.createPropertyAssignment(
                ts.factory.createIdentifier(ServiceTypesConstants.Commons.Request.Properties.Body.PROPERTY_NAME),
                ts.factory.createIdentifier(ClientConstants.WebsocketChannel.Operation.Signature.REQUEST_PARAMETER)
            )
        );
    }

    if (operationTypes.request.wrapper == null) {
        // TODO change the type of operationTypes so we don't have to throw!
        throw new Error("Operation request wrapper is not defined. This is a product error");
    }

    return [
        ts.factory.createVariableStatement(
            undefined,
            ts.factory.createVariableDeclarationList(
                [
                    ts.factory.createVariableDeclaration(
                        ts.factory.createIdentifier(MESSAGE_LOCAL_VARIABLE_NAME),
                        undefined,
                        getServiceTypeReference({
                            reference: operationTypes.request.wrapper.reference,
                            referencedIn: channelFile,
                            modelDirectory,
                            modelContext,
                        }),
                        ts.factory.createObjectLiteralExpression(messageElements, true)
                    ),
                ],
                ts.NodeFlags.Const
            )
        ),
        ts.factory.createExpressionStatement(
            ts.factory.createBinaryExpression(
                ts.factory.createElementAccessExpression(
                    ts.factory.createPropertyAccessExpression(
                        ts.factory.createThis(),
                        ts.factory.createIdentifier(ClientConstants.WebsocketChannel.PrivateMembers.CALLBACKS)
                    ),
                    ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier(MESSAGE_LOCAL_VARIABLE_NAME),
                        ts.factory.createIdentifier(ServiceTypesConstants.WebsocketChannel.Request.Properties.ID)
                    )
                ),
                ts.factory.createToken(ts.SyntaxKind.EqualsToken),
                ts.factory.createIdentifier("resolve")
            )
        ),
        ts.factory.createExpressionStatement(
            ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                    ts.factory.createIdentifier(SOCKET_LOCAL_VARIABLE_NAME),
                    ts.factory.createIdentifier("send")
                ),
                undefined,
                [
                    ts.factory.createCallExpression(
                        ts.factory.createPropertyAccessExpression(
                            ts.factory.createIdentifier("JSON"),
                            ts.factory.createIdentifier("stringify")
                        ),
                        undefined,
                        [ts.factory.createIdentifier(MESSAGE_LOCAL_VARIABLE_NAME)]
                    ),
                ]
            )
        ),
    ];
}
