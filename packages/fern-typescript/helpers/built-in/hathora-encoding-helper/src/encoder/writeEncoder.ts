import { IntermediateRepresentation } from "@fern-api/api";
import { FernWriters, getTextOfTsNode, TypeResolver } from "@fern-typescript/commons";
import { ts, tsMorph } from "@fern-typescript/helper-utils";
import { HathoraEncoderConstants } from "../constants";
import { writeContainers } from "./containers/writeContainers";
import { writeModel } from "./model/writeModel";
import { writePrimitives } from "./writePrimitives";

export declare namespace writeEncoder {
    export interface Args {
        file: tsMorph.SourceFile;
        modelDirectory: tsMorph.Directory;
        intermediateRepresentation: IntermediateRepresentation;
        typeResolver: TypeResolver;
    }
}

export function writeEncoder({
    file,
    intermediateRepresentation,
    typeResolver,
    modelDirectory,
}: writeEncoder.Args): void {
    file.addImportDeclaration({
        namespaceImport: HathoraEncoderConstants.BinSerDe.NAMESPACE_IMPORT,
        moduleSpecifier: "bin-serde",
    });

    const objectWriter = FernWriters.object.writer({ newlinesBetweenProperties: true });
    objectWriter.addProperties({
        [HathoraEncoderConstants.Primitives.NAME]: writePrimitives(),
        [HathoraEncoderConstants.Containers.NAME]: writeContainers(),
        [HathoraEncoderConstants.Model.NAME]: writeModel({
            types: intermediateRepresentation.types,
            typeResolver,
            file,
            modelDirectory,
        }),
        [HathoraEncoderConstants.Services.NAME]: getTextOfTsNode(ts.factory.createStringLiteral("TODO")),
        [HathoraEncoderConstants.Errors.NAME]: getTextOfTsNode(ts.factory.createStringLiteral("TODO")),
    });

    file.addVariableStatement({
        declarationKind: tsMorph.VariableDeclarationKind.Const,
        declarations: [
            {
                name: HathoraEncoderConstants.NAME,
                initializer: objectWriter.toFunction(),
            },
        ],
        isExported: true,
    });
}
