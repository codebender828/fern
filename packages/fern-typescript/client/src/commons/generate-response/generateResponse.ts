import { FailedResponse, Type } from "@fern-api/api";
import {
    createSourceFile,
    DependencyManager,
    getOrCreateSourceFile,
    getTextOfTsNode,
    SourceFileManager,
    TypeResolver,
} from "@fern-typescript/commons";
import { Directory, OptionalKind, PropertySignatureStructure, ts, Writers } from "ts-morph";
import { ClientConstants } from "../../constants";
import { generateServiceTypeReference } from "../service-types/generateServiceTypeReference";
import { LocalServiceTypeReference, ServiceTypeReference } from "../service-types/types";
import { generateErrorBody } from "./generateErrorBody";

export declare namespace generateResponse {
    export interface Args {
        directory: Directory;
        errorsDirectory: Directory;
        modelDirectory: Directory;
        typeResolver: TypeResolver;
        dependencyManager: DependencyManager;
        successResponse: {
            docs: string | null | undefined;
            type: Type;
        };
        failedResponse: FailedResponse;
        getTypeReferenceToServiceType: (args: {
            reference: ServiceTypeReference;
            referencedIn: SourceFileManager;
        }) => ts.TypeNode;
        additionalProperties?: OptionalKind<PropertySignatureStructure>[];
    }

    export interface Return {
        reference: LocalServiceTypeReference;
        successBodyReference: ServiceTypeReference | undefined;
    }
}

export function generateResponse({
    errorsDirectory,
    modelDirectory,
    typeResolver,
    dependencyManager,
    successResponse,
    failedResponse,
    getTypeReferenceToServiceType,
    directory,
    additionalProperties = [],
}: generateResponse.Args): generateResponse.Return {
    const successBodyReference = generateServiceTypeReference({
        typeName: ClientConstants.Commons.Types.Response.Success.Properties.Body.TYPE_NAME,
        type: successResponse.type,
        docs: successResponse.docs,
        typeDirectory: directory,
        modelDirectory,
        typeResolver,
    });

    const responseFile = createSourceFile(directory, `${ClientConstants.Commons.Types.Response.TYPE_NAME}.ts`);

    responseFile.file.addTypeAlias({
        name: ClientConstants.Commons.Types.Response.TYPE_NAME,
        type: Writers.unionType(
            ClientConstants.Commons.Types.Response.Success.TYPE_NAME,
            ClientConstants.Commons.Types.Response.Error.TYPE_NAME
        ),
        isExported: true,
    });

    addSuccessResponseInterface({
        responseFile,
        successBodyReference,
        getTypeReferenceToServiceType,
        additionalProperties,
    });

    const errorBodyFile = getOrCreateSourceFile(
        directory,
        `${ClientConstants.Commons.Types.Response.Error.Properties.Body.TYPE_NAME}.ts`
    );

    generateErrorBody({
        failedResponse,
        errorBodyFile,
        errorsDirectory,
        typeResolver,
        modelDirectory,
        dependencyManager,
    });

    responseFile.file.addInterface({
        name: ClientConstants.Commons.Types.Response.Error.TYPE_NAME,
        isExported: true,
        properties: [
            ...createBaseResponseProperties({ ok: false }),
            ...additionalProperties,
            {
                name: ClientConstants.Commons.Types.Response.Error.Properties.Body.PROPERTY_NAME,
                type: getTextOfTsNode(
                    getTypeReferenceToServiceType({
                        reference: {
                            isLocal: true,
                            typeName: ClientConstants.Commons.Types.Response.Error.Properties.Body.TYPE_NAME,
                            file: errorBodyFile,
                        },
                        referencedIn: responseFile,
                    })
                ),
            },
        ],
    });

    return {
        reference: {
            isLocal: true,
            typeName: ClientConstants.Commons.Types.Response.TYPE_NAME,
            file: responseFile,
        },
        successBodyReference,
    };
}

function addSuccessResponseInterface({
    successBodyReference,
    getTypeReferenceToServiceType,
    responseFile,
    additionalProperties,
}: {
    successBodyReference: ServiceTypeReference | undefined;
    getTypeReferenceToServiceType: (args: {
        reference: ServiceTypeReference;
        referencedIn: SourceFileManager;
    }) => ts.TypeNode;
    responseFile: SourceFileManager;
    additionalProperties: OptionalKind<PropertySignatureStructure>[];
}): void {
    const successResponseBodyReference =
        successBodyReference != null
            ? getTypeReferenceToServiceType({ reference: successBodyReference, referencedIn: responseFile })
            : undefined;

    responseFile.file.addInterface({
        name: ClientConstants.Commons.Types.Response.Success.TYPE_NAME,
        isExported: true,
        properties: generateSuccessResponseProperties({
            successResponseBodyReference,
            additionalProperties,
        }),
    });
}

function generateSuccessResponseProperties({
    successResponseBodyReference,
    additionalProperties,
}: {
    successResponseBodyReference: ts.TypeNode | undefined;
    additionalProperties: OptionalKind<PropertySignatureStructure>[];
}): OptionalKind<PropertySignatureStructure>[] {
    const properties = [...createBaseResponseProperties({ ok: true }), ...additionalProperties];

    if (successResponseBodyReference != null) {
        properties.push({
            name: ClientConstants.Commons.Types.Response.Success.Properties.Body.PROPERTY_NAME,
            type: getTextOfTsNode(successResponseBodyReference),
        });
    }

    return properties;
}

function createBaseResponseProperties({ ok }: { ok: boolean }): OptionalKind<PropertySignatureStructure>[] {
    return [
        {
            name: ClientConstants.Commons.Types.Response.Properties.OK,
            type: getTextOfTsNode(
                ts.factory.createLiteralTypeNode(ok ? ts.factory.createTrue() : ts.factory.createFalse())
            ),
        },
    ];
}
