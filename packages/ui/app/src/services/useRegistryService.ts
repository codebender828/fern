import { FernRegistryClient } from "@fern-fern/registry";
import { useMemo } from "react";
import { useGetToken } from "../auth/useGetToken";
import { VENUS_AUDIENCE } from "./useVenus";

const FDR_ORIGIN = import.meta.env.VITE_FDR_ORIGIN ?? "https://registry.buildwithfern.com";

export function useRegistryService(): FernRegistryClient {
    const getToken = useGetToken({ audience: VENUS_AUDIENCE });

    return useMemo(() => {
        return new FernRegistryClient({
            environment: FDR_ORIGIN,
            token: getToken,
        });
    }, [getToken]);
}
