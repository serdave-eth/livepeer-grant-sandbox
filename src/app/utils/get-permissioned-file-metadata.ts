import { ethers } from "ethers";
import { PermissionsRegistryAbi } from "@keypo/contracts";

export const getPermissionedFileMetadata = async (
  permissionsRegistryAddress: string,
  permissionedFileSmartContractAddress: string,
  rpcUrl: string,
) => {
  const permissionsRegistryContract = new ethers.Contract(
    permissionsRegistryAddress,
    PermissionsRegistryAbi,
    new ethers.providers.JsonRpcProvider(rpcUrl),
  );

  return await permissionsRegistryContract.fileContractToFileMetadataIdentifier(
    ethers.utils.getAddress(permissionedFileSmartContractAddress),
  );
};
