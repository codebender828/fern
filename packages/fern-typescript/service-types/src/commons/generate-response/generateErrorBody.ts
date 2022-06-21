import { FailedResponse, PrimitiveType, ResponseError, TypeReference } from "@fern-api/api";
import {
    DependencyManager,
    ErrorResolver,
    generateUuidCall,
    ImportStrategy,
    ModelContext,
    resolveType,
    TypeResolver,
} from "@fern-typescript/commons";
import { generateUnionType, isTypeExtendable, ResolvedSingleUnionValueType } from "@fern-typescript/types";
import { SourceFile } from "ts-morph";
import { ServiceTypeMetadata } from "../service-type-reference/types";

export function generateErrorBody({
    failedResponse,
    errorBodyFile,
    errorBodyMetadata,
    modelContext,
    typeResolver,
    errorResolver,
    dependencyManager,
}: {
    failedResponse: FailedResponse;
    errorBodyFile: SourceFile;
    errorBodyMetadata: ServiceTypeMetadata;
    modelContext: ModelContext;
    typeResolver: TypeResolver;
    errorResolver: ErrorResolver;
    dependencyManager: DependencyManager;
}): void {
    generateUnionType({
        file: errorBodyFile,
        typeName: errorBodyMetadata.typeName,
        docs: failedResponse.docs,
        discriminant: failedResponse.discriminant,
        resolvedTypes: failedResponse.errors.map((error) => ({
            docs: error.docs,
            discriminantValue: error.discriminantValue,
            valueType: getValueType({ error, file: errorBodyFile, modelContext, typeResolver, errorResolver }),
        })),
        additionalPropertiesForEveryType: [
            {
                key: failedResponse.errorProperties.errorInstanceId,
                valueType: TypeReference.primitive(PrimitiveType.String),
                generateValueCreator: ({ file }) => {
                    return generateUuidCall({ file, dependencyManager });
                },
            },
        ],
        modelContext,
    });
}

function getValueType({
    error,
    file,
    modelContext,
    typeResolver,
    errorResolver,
}: {
    error: ResponseError;
    file: SourceFile;
    modelContext: ModelContext;
    typeResolver: TypeResolver;
    errorResolver: ErrorResolver;
}): ResolvedSingleUnionValueType | undefined {
    const errorDefinition = errorResolver.resolveError(error.error);

    const resolvedType = resolveType(errorDefinition.type, (typeName) => typeResolver.resolveTypeName(typeName));

    if (resolvedType._type === "void") {
        return undefined;
    }

    return {
        isExtendable: isTypeExtendable(resolvedType),
        type: modelContext.getReferenceToError({
            errorName: error.error,
            importStrategy: ImportStrategy.NAMED_IMPORT,
            referencedIn: file,
        }),
    };
}
