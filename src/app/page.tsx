"use client"
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import {
  createSiweMessageWithRecaps,
  generateAuthSig,
  LitAbility,
  LitAccessControlConditionResource,
  LitActionResource,
  LitPKPResource,
  AuthSig
} from "@lit-protocol/auth-helpers";
import { disconnectWeb3 } from "@lit-protocol/auth-browser";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { mainnet } from "wagmi/chains";
import { ethers, Signer } from 'ethers';  // Import Signer correctly

interface AuthCallbackParams {
  resourceAbilityRequests?: any[];  // Define more specific type if possible
  expiration?: string;
  uri?: string;
}

const accessControlConditions = [
  {
    contractAddress: '',
    standardContractType: '',
    chain: 'ethereum',
    method: '',
    parameters: [
      ':userAddress',
    ],
    returnValueTest: {
      comparator: '=',
      value: '0x6058b9bDC6F223eba8B1D148ba319dcAe83eB4e9'
    }
  }
]

function getAuthNeededCallback(litNodeClient: LitNodeClient, ethersSigner: Signer) {
  return async ({ resourceAbilityRequests, expiration, uri }: AuthCallbackParams): Promise<AuthSig> => {
    if (!resourceAbilityRequests || !expiration || !uri) {
      throw new Error("Missing required parameters for authentication.");
    }

    const walletAddress = await ethersSigner.getAddress();
    const nonce = await litNodeClient.getLatestBlockhash();

    const toSign = await createSiweMessageWithRecaps({
      uri,
      expiration,
      resources: resourceAbilityRequests,
      walletAddress,
      nonce,
      litNodeClient,
    });

    return generateAuthSig({
      signer: ethersSigner,
      toSign,
    });
  };
}

async function getLitNodeClient() {
  const litNodeClient = new LitNodeClient({
    litNetwork: LitNetwork.Cayenne,
  });

  console.log("Connecting litNodeClient to network...");
  await litNodeClient.connect();

  console.log("litNodeClient connected!");
  return litNodeClient;
}

async function getSessionSigs(litNodeClient: LitNodeClient, ethersSigner: Signer) {
  console.log("Getting Session Signatures...");
  return litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    resourceAbilityRequests: [
      {
        resource: new LitPKPResource("*"),
        ability: LitAbility.PKPSigning,
      },
      {
        resource: new LitActionResource("*"),
        ability: LitAbility.LitActionExecution,
      },
    ],
    authNeededCallback: getAuthNeededCallback(litNodeClient, ethersSigner),
  });
}

const Home = () => {
  const [showVideoButton, setShowVideoButton] = useState(false);
  
  useEffect(() => {
    // Call disconnectWeb3 when the component mounts
    disconnectWeb3();
    console.log('Disconnected Web3 provider on component mount.');
  }, []); // Empty dependency array ensures this effect runs only once on mount
  
  const handleCheckAccess = async () => {
      if (typeof window !== 'undefined') {
          try {
              const provider = new ethers.providers.Web3Provider(window.ethereum);
              await provider.send("eth_requestAccounts", []);
              const ethersSigner = provider.getSigner();
              console.log("Connected account:", await ethersSigner.getAddress());

              const litNodeClient = await getLitNodeClient();
              const sessionSigs = await getSessionSigs(litNodeClient, ethersSigner);
              console.log("Got Session Signatures!");
              const jwt = await litNodeClient.getSignedToken({
                accessControlConditions,
                chain: 'ethereum',
                sessionSigs,
              });
              console.log("Signed JWT: ", jwt);
              // Make the Watch Video button visible after logging the client*/
              setShowVideoButton(true);
          } catch (error) {
              console.error('Failed to check access:', error);
          }
      }
  };

  return (
      <div>
          <h1>Welcome to Digital DVD</h1>
          <button type="button" onClick={handleCheckAccess}>
              Check Access
          </button>
          {showVideoButton && (
              <Link href="/video">
                  <button type="button">Watch Video</button>
              </Link>
          )}
      </div>
  );
};

export default Home;
