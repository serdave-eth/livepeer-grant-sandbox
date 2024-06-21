"use client"
import { useEffect, useState } from 'react';
import { LitNetwork } from "@lit-protocol/constants";
import { disconnectWeb3 } from "@lit-protocol/auth-browser";
import { LitNodeClient, encryptString, decryptToString } from "@lit-protocol/lit-node-client";
import { LitAbility, LitAccessControlConditionResource, LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from "@lit-protocol/auth-helpers";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { mainnet } from "wagmi/chains";
import { ethers, Signer } from 'ethers';  // Import Signer correctly
import { getSrc } from "@livepeer/react/external";
import { Livepeer } from "livepeer";
import { DemoPlayer } from "@/app/components/DemoPlayer";
import { Src } from '@livepeer/react';


interface AuthCallbackParams {
  resourceAbilityRequests?: any[];  // Define more specific type if possible
  expiration?: string;
  uri?: string;
  resources?: any;
}

const ONE_WEEK_FROM_NOW = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7
).toISOString();

const chain = "ethereum";

//Source string is encrypted using access control condition that you hold a specific ERC721 NFT
//then on server side is decrypted using same access control condition, and cross-checked with
//original source string
const source_string = "Livepeer Grant P1";

//Playback ID of token gated video. Only works if you have signed JWT from API end point
const playbackId = "cc53eb8slq3hrhoi";

/*const accessControlConditions = [
  {
    contractAddress: '0xBbbed53F08eF748b0FD9D52D9c301A55b9123334',
    standardContractType: 'ERC721',
    chain: "base",
    method: 'balanceOf',
    parameters: [
      ':userAddress'
    ],
    returnValueTest: {
      comparator: '>',
      value: '0'
    }
  }
]*/

// Function to fetch playback info
async function getPlaybackInfo(playbackId: string) {
  const api_key = process.env.LIVEPEER_SECRET_API_KEY;
  const livepeer = new Livepeer({apiKey: api_key});
  const playbackInfo = await livepeer.playback.get(playbackId);
  return getSrc(playbackInfo.playbackInfo);
}

async function getLitNodeClient() {
  const litNodeClient = new LitNodeClient({
    litNetwork: LitNetwork.Cayenne,
    debug: true
  });

  console.log("Connecting litNodeClient to network...");
  await litNodeClient.connect();

  console.log("litNodeClient connected!");
  return litNodeClient;
}

const genAuthSig = async (
  signer: ethers.providers.JsonRpcSigner,
  client: LitNodeClient,
  uri: string,
  resources: any[]
) => {

  const walletAddress = await signer.getAddress();
  let blockHash = await client.getLatestBlockhash();
  const message = await createSiweMessageWithRecaps({
      walletAddress: walletAddress,
      nonce: blockHash,
      litNodeClient: client,
      resources,
      expiration: ONE_WEEK_FROM_NOW,
      uri
  })
  // Generate the authSig
  const authSig = await generateAuthSig({
    signer: signer,
    toSign: message,
  });


  return authSig;
}

const genSession = async (
  signer: ethers.providers.JsonRpcSigner,
  client: LitNodeClient,
  resources: any[]) => {
  let sessionSigs = await client.getSessionSigs({
      chain: chain,
      resourceAbilityRequests: resources,
      authNeededCallback: async (params: AuthCallbackParams) => {
        console.log("resourceAbilityRequests:", params.resources);

        if (!params.expiration) {
          throw new Error("expiration is required");
        }

        if (!params.resources) {
          throw new Error("resourceAbilityRequests is required");
        }

        if (!params.uri) {
          throw new Error("uri is required");
        }

        // generate the authSig for the inner signature of the session
        // we need capabilities to assure that only one api key may be decrypted
        const authSig = genAuthSig(signer, client, params.uri, params.resourceAbilityRequests ?? []);
        return authSig;
      }
  });

  return sessionSigs;
}

const Home = () => {
  const [showVideoButton, setShowVideoButton] = useState(false);
  const [videoSrc, setVideoSrc] = useState<Src[] | null>(null); // State to store video source
  const [signedJWT, setSignedJWT] = useState('');  // State to hold the signed JWT
  const [walletConnected, setWalletConnected] = useState(false); // Check wallet connection
  const [ethersSigner, setEthersSigner] = useState<ethers.providers.JsonRpcSigner | null>(null);
  
  useEffect(() => {
    // Call disconnectWeb3 when the component mounts
    disconnectWeb3();
    console.log('Disconnected Web3 provider on component mount.');
  }, []); // Empty dependency array ensures this effect runs only once on mount

  useEffect(() => {
    if (signedJWT && !videoSrc) {
      getPlaybackInfo(playbackId).then(playbackResponse => {
        setVideoSrc(playbackResponse);
        if (playbackResponse) {
          setShowVideoButton(true); 
        }
      });
    } else {
      console.log("Waiting on JWT or Video Source:", { jwt: signedJWT, src: videoSrc });
    }
  }, [signedJWT, videoSrc]);
  
  
  
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const ethersSigner = provider.getSigner();
            console.log("Connected account:", await ethersSigner.getAddress());
            setEthersSigner(ethersSigner);  // Save the signer in state
            setWalletConnected(true);
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    } else {
        console.error("MetaMask is not installed!");
        alert("Please install MetaMask to connect your wallet.");
    }
};


  const handleCheckAccess = async () => {
    if (walletConnected) {
        try {
            //Connect Lit Node Client
            let litNodeClient = await getLitNodeClient();
            
            const accessControlConditions = [
              {
                contractAddress: '',
                standardContractType: '',
                chain: chain,
                method: '',
                parameters: [
                  ':userAddress',
                ],
                returnValueTest: {
                  comparator: '=',
                  value: '0xfF3b1ac7ac4BBb1c56f7d3D0b81E366227E6f137'
                }
              }
            ]
            
            //Encrypt the source string using access control condition that a wallet holds a specific ERC721 NFT
            const { ciphertext, dataToEncryptHash } = await encryptString(
              {
                  accessControlConditions,
                  dataToEncrypt: source_string,
              },
              litNodeClient
          );

          console.log("cipher text:", ciphertext, "hash:", dataToEncryptHash);
          const accsResourceString = 
            await LitAccessControlConditionResource.generateResourceString(accessControlConditions as any, dataToEncryptHash);
          let sessionForDecryption;  
          if(ethersSigner) {
            sessionForDecryption = await genSession(ethersSigner, litNodeClient, [
              { 
                  resource: new LitAccessControlConditionResource(accsResourceString),
                  ability: LitAbility.AccessControlConditionDecryption,
    
              }
            ]
          );
          console.log("session sigs: ", sessionForDecryption);
          }

          // Send encrypted string to server. If decrypted string is same as source string, server signs JWT
          const response = await fetch('/api/sign-jwt', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  ciphertext: ciphertext, // You might need to adjust based on your API needs
                  dataToEncryptHash: dataToEncryptHash,
                  sessionSigs: sessionForDecryption,
                  videoPlayBack: playbackId
              })
          });
          const data = await response.json();
          setSignedJWT(data.token);
          console.log("JWT updated to:", data.token); // Ensure the token is being logged correctly here
        } catch (error) {
            console.error('Failed to check access:', error);
        }
    }
};


return (
  <div>
      <h1>Welcome to Digital DVD</h1>
      {!walletConnected && (
          <button type="button" onClick={connectWallet}>
              Connect Wallet
          </button>
      )}
      {walletConnected && (
          <button type="button" onClick={handleCheckAccess}>
              Check Access
          </button>
      )}
      {showVideoButton && videoSrc && signedJWT && (
        <DemoPlayer src={videoSrc} jwt={signedJWT} />
      )}
  </div>
);

};

export default Home;
