import { TypeReference } from "@fern-api/api";
import { SourceFileManager } from "@fern-typescript/commons";
import { ClientConstants } from "../../constants";

export type ServiceTypeReference = LocalServiceTypeReference | ModelServiceTypeReference;

export interface LocalServiceTypeReference {
    // is located in a file local to this service, not imported from the model
    isLocal: true;
    typeName: ServiceTypeName;
    file: SourceFileManager;
}

export interface ModelServiceTypeReference {
    // is imported from the model
    isLocal: false;
    typeReference: Exclude<TypeReference, TypeReference.Void>;
}

export type ServiceTypeName =
    | typeof ClientConstants.Commons.Types.Request.TYPE_NAME
    | typeof ClientConstants.Commons.Types.Request.Properties.Body.TYPE_NAME
    | typeof ClientConstants.Commons.Types.Response.TYPE_NAME
    | typeof ClientConstants.Commons.Types.Response.Success.Properties.Body.TYPE_NAME
    | typeof ClientConstants.Commons.Types.Response.Error.Properties.Body.TYPE_NAME;
