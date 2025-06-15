import axios from "axios";
import { ethers } from "ethers";
import {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitAccessControlConditionResource,
  LitActionResource,
} from "@lit-protocol/auth-helpers";
import { LIT_NETWORK } from "@lit-protocol/constants";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import {
  LitAbility,
  type AccessControlConditions,
  type LIT_NETWORKS_KEYS,
} from "@lit-protocol/types";
import { getPermissionedFileMetadata } from "./get-permissioned-file-metadata";
import { PermissionsRegistryAbi } from "@keypo/contracts";

export interface KeypoRefs {
  Version: string;
  KeypoApiUrl: string;
  RegistryContractAddress: string;
  DefaultValidationContractAddress: string;
  DefaultLitActionCID: string;
  DefaultJSONRPC: string;
  ChainId: string;
  Chain: string;
  GetFileDataByOwnerSubGraph: string;
  IPFSBaseUrl: string;
}

export type KeypoFile = {
  cid: string;
  fileContractAddress: string;
  fileIdentifier: string;
  // ...other possible metadata fields
  [key: string]: any;
};

export interface Keypo {
  files: Record<string, KeypoFile>;
  constants: KeypoRefs;
}


export async function fetchKeypoRefs(): Promise<KeypoRefs> {
  return {
    Version: "1.0.0",
    KeypoApiUrl: "https://api.keypo.io",
    RegistryContractAddress: "0xe0859b58A008658549411CC1Bd258780e66e764f",
    DefaultValidationContractAddress: "0x35ADB6b999AbcD5C9CdF2262c7190C7b96ABcE4C",
    DefaultLitActionCID: "QmSJ1zMTLchh5zazk5dhPpoJJ6j21D9nfNSYexfmFezC8y",
    DefaultJSONRPC: "https://sepolia.base.org",
    ChainId: "84532",
    Chain: "baseSepolia",
    GetFileDataByOwnerSubGraph: "https://gateway.thegraph.com/api/subgraphs/id/3DYoVYkrq6vHDufNpczKRWrPCkhoopeKz4o3sYkhK229",
    IPFSBaseUrl: "https://ipfs.io/ipfs/"
  };
}

export const init = async (walletAddress: string): Promise<Keypo> => {
  const refs = await fetchKeypoRefs();
  // Get all file data including metadata
  const files = await getFileDataByUser(walletAddress, refs);

  // Convert array of files to object with fileName as key
  const fileEntries: [string, KeypoFile][] = files.map((file) => [
    file.fileName,
    {
      cid: file.fileCID || "",
      fileContractAddress: file.fileContractAddress,
      fileIdentifier: file.fileIdentifier,
      ...(file.fileMetadata ? JSON.parse(file.fileMetadata) : {}),
    } as KeypoFile,
  ]);

  return {
    files: Object.fromEntries(fileEntries),
    constants: refs,
  };
};

export const getFileDataByUser = async (
  userAddress: string,
  keypoRefs: KeypoRefs,
): Promise<
  {
    fileIdentifier: string;
    fileContractAddress: string;
    fileName: string;
    fileCID?: string;
    fileMetadata?: string;
  }[]
> => {
  try {
    const pageSize = 100;
    const allDeployed: any[] = [];
    const allDeleted: any[] = [];
    let hasMore = true;
    let skip = 0;

    // Fetch both owner and minter files
    while (hasMore) {
      // Get owned files
      const [ownerRes, minterRes] = await Promise.all([
        axios.get(
          `${keypoRefs.KeypoApiUrl}/graph/filesByAdmin?fileOwnerAddress=${userAddress}&first=${pageSize}&skip=${skip}`,
        ),
        axios.get(
          `${keypoRefs.KeypoApiUrl}/graph/filesByMinter?fileMinterAddress=${userAddress}&first=${pageSize}&skip=${skip}`,
        ),
      ]);

      const ownerFiles = ownerRes.data.permissionedFileDeployeds || [];
      const minterFiles = minterRes.data.permissionedFileAccessMinteds || [];

      // Add valid files to our collection
      allDeployed.push(...ownerFiles, ...minterFiles);

      // Get all contract addresses for deleted files check
      const deployedAddresses = [
        ...ownerFiles.map((file: any) => file.fileContractAddress),
        ...minterFiles.map((file: any) => file.fileContractAddress),
      ];

      // Get deleted files
      const deletedRes = await axios.get(
        `${keypoRefs.KeypoApiUrl}/graph/deletedFiles?addresses=${encodeURIComponent(JSON.stringify(deployedAddresses))}`,
      );
      allDeleted.push(...(deletedRes.data.permissionedFileDeleteds || []));

      // Check if we need to fetch more pages
      hasMore =
        ownerFiles.length === pageSize || minterFiles.length === pageSize;
      skip += pageSize;
    }

    // Process all files at once
    const deletedFiles = new Set(
      allDeleted.map(
        (file) =>
          `${file.fileContractAddress.toLowerCase()}-${file.fileIdentifier}`,
      ),
    );

    // Process and return full file data
    return allDeployed
      .filter((file: any) => {
        const key = `${file.fileContractAddress.toLowerCase()}-${file.fileIdentifier}`;
        return !deletedFiles.has(key) && file.fileMetadata;
      })
      .map((file: any) => {
        let metadata;
        try {
          metadata = JSON.parse(file.fileMetadata);
        } catch (e) {
          console.error("Error parsing file metadata:", e);
          return null;
        }

        if (!metadata) {
          return null;
        }

        return {
          fileIdentifier: file.fileIdentifier,
          fileContractAddress: file.fileContractAddress,
          fileName: metadata.fileName || metadata.keyName || metadata.name,
          fileCID: metadata.cid,
          fileMetadata: file.fileMetadata,
        };
      })
      .filter(
        (
          file,
        ): file is {
          fileIdentifier: string;
          fileContractAddress: string;
          fileName: string;
          fileCID: string;
          fileMetadata: string;
        } => file !== null,
      );
  } catch (error) {
    console.error("Error fetching file data:", error);
    return [];
  }
};

interface AuthCallbackParams {
  resourceAbilityRequests?: any[]; // Define more specific type if possible
  expiration?: string;
  uri?: string;
  resources?: any;
}

const ONE_WEEK_FROM_NOW = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7,
).toISOString();

const ipfsBaseUrl = "https://ipfs.io/ipfs/";

export const genAuthSig = async (
  signer: ethers.Signer,
  client: LitNodeClient,
  uri: string,
  resources: any[],
  expiration: string = ONE_WEEK_FROM_NOW,
): Promise<any> => {
  const blockHash = await client.getLatestBlockhash();
  const address = await signer.getAddress();
  const message = await createSiweMessageWithRecaps({
    walletAddress: address,
    nonce: blockHash,
    litNodeClient: client,
    resources,
    expiration: expiration,
    uri,
  });
  return generateAuthSig({
    signer: signer,
    toSign: message,
    address: address,
  });
};

export const genSession = async (
  signer: ethers.Signer,
  client: LitNodeClient,
  resources: any[],
  expiration: string = ONE_WEEK_FROM_NOW,
  chain = "base",
  authSig?: any,
): Promise<any> => {
  return client.getSessionSigs({
    chain: chain,
    resourceAbilityRequests: resources,
    authNeededCallback: async (params: AuthCallbackParams) => {
      if (!params.expiration || !params.resources || !params.uri) {
        throw new Error("All parameters must be defined");
      }

      // If authSig is provided, return it directly
      if (authSig) {
        return authSig;
      }

      // Otherwise generate a new one
      const safeResources = params.resourceAbilityRequests || [];
      return genAuthSig(signer, client, params.uri, safeResources, expiration);
    },
  });
};

export const authenticateLitSession = async (
  signer: ethers.Signer,
  permissionsRegistryContractAddress: string,
  permissionedFileSmartContractAddress: string,
  rpcUrl: string,
): Promise<{
  sessionSigs: any;
  authSig: any;
  litNodeClient: LitNodeClient;
}> => {
  const keyMetadataCid = await getPermissionedFileMetadata(
    permissionsRegistryContractAddress,
    permissionedFileSmartContractAddress,
    rpcUrl,
  );
  if (!keyMetadataCid) {
    throw new Error(
      "No key metadata found for the provided smart contract address",
    );
  }
  //TODO: make keyMetadataCid a JSON object
  const keyMetadataCidObject = JSON.parse(keyMetadataCid);

  // Retrieve the key metadata from IPFS and extract ciphertext and dataToEncryptHash
  const keyMetadataResponse = (await axios.get(
    `${ipfsBaseUrl}${keyMetadataCidObject.cid}`
  )) as {
    data: {
      ciphertext: string;
      userField: {
        dataToEncryptHash: string;
        litActionCid: string;
        endPoints: string[];
      };
    };
  };

  const fileData = keyMetadataResponse.data;

  const litNodeClient = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev as LIT_NETWORKS_KEYS,
    debug: false,
  });

  await litNodeClient.connect();

  const accessControlConditions: AccessControlConditions = [
    {
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":currentActionIpfsId"],
      returnValueTest: {
        comparator: "=",
        value: fileData.userField.litActionCid,
      },
    },
  ];

  const accsResourceString =
    await LitAccessControlConditionResource.generateResourceString(
      accessControlConditions as any,
      fileData.userField.dataToEncryptHash,
    );
  const resources = [
    {
      resource: new LitActionResource("*"),
      ability: LitAbility.LitActionExecution,
    },
    {
      resource: new LitAccessControlConditionResource(accsResourceString),
      ability: LitAbility.AccessControlConditionDecryption,
    },
  ];

  const sessionSigs = await genSession(signer, litNodeClient, resources);

  //TODO: generate seperate authsig for checkPermission
  const authSig = await genAuthSig(
    signer,
    litNodeClient,
    "https://www.google.com",
    resources,
  );

  return {
    sessionSigs,
    authSig,
    litNodeClient: litNodeClient,
  };
};

export async function getLitAuthData(
  api: string,
  keypo: Keypo,
  wallet: ethers.Wallet,
) {
  const config = keypo.files[api] as any;

  if (!config) {
    throw new Error(`No configuration found for API: ${api}`);
  }

  const cid = config.cid;
  if (!cid) {
    throw new Error(`No CID found in config for API: ${api}`);
  }

  const permissionsRegistryContract = new ethers.Contract(
    keypo.constants.RegistryContractAddress,
    PermissionsRegistryAbi,
    wallet.provider,
  );

  const file = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  const fileJson = (await file.json()) as any;

  const fileContractAddress =
    await permissionsRegistryContract.fileIdentifierToFileContract(
      fileJson.userField.dataToEncryptHash,
    );

  const { sessionSigs, authSig, litNodeClient } = await authenticateLitSession(
    wallet,
    keypo.constants.RegistryContractAddress,
    fileContractAddress,
    keypo.constants.DefaultJSONRPC,
  );

  return {
    sessionSigs,
    authSig,
    litNodeClient,
    fileContractAddress,
  };
}

