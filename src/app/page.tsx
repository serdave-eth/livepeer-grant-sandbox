"use client"
import { useEffect, useState } from 'react';
import { disconnectWeb3 } from "@lit-protocol/auth-browser";
import { encryptString} from "@lit-protocol/lit-node-client";
import { LitAbility, LitAccessControlConditionResource, LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from "@lit-protocol/auth-helpers";
import { ethers, Signer } from 'ethers';  // Import Signer correctly
import { DemoPlayer } from "@/app/components/DemoPlayer";
import { Src } from '@livepeer/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { LoginButton } from './components/LoginButton';
import { LogoutButton } from './components/LogoutButton';
import { getLitNodeClient, genSession } from './utils/litUtils';
import { getPlaybackInfo } from './utils/livepeerUtils';

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

const livepeerApiKey = process.env.LIVEPEER_SECRET_API_KEY ?? "";

//Source string is encrypted using access control condition that you hold a specific ERC721 NFT
//then on server side is decrypted using same access control condition, and cross-checked with
//original source string
const source_string = "Livepeer Grant P1";

//Playback ID of token gated video. Only works if you have signed JWT from API end point
const playbackId = "cc53eb8slq3hrhoi";

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
      value: '0x6058b9bDC6F223eba8B1D148ba319dcAe83eB4e9'
    }
  }
]

const Home = () => {
  const [showVideoButton, setShowVideoButton] = useState(false);
  const [videoSrc, setVideoSrc] = useState<Src[] | null>(null); // State to store video source
  const [signedJWT, setSignedJWT] = useState('');  // State to hold the signed JWT

  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0];

  useEffect(() => {
    // Call disconnectWeb3 when the component mounts
    disconnectWeb3();
    console.log('Disconnected Web3 provider on component mount.');
  }, []); // Empty dependency array ensures this effect runs only once on mount

  useEffect(() => {
    if (signedJWT && !videoSrc) {
      getPlaybackInfo(playbackId, livepeerApiKey).then(playbackResponse => {
        setVideoSrc(playbackResponse);
        if (playbackResponse) {
          setShowVideoButton(true); 
        }
      });
    } else {
      console.log("Waiting on JWT or Video Source:", { jwt: signedJWT, src: videoSrc });
    }
  }, [signedJWT, videoSrc]);

  const handleCheckAccess = async () => {
        try {
            //Connect Lit Node Client
            let litNodeClient = await getLitNodeClient();
            
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
          const userSigner = await userWallet.getEthereumProvider();
          // Wrap the EIP-1193 provider with ethers
          const provider = new ethers.providers.Web3Provider(userSigner);

          // Get the signer from the ethers provider
          const signer = provider.getSigner();
          let sessionForDecryption;  
          if(userSigner) {
            sessionForDecryption = await genSession(signer, litNodeClient, [
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
          console.log("JWT updated to:", data.token); // Ensure the token is being logged correctly here*/
        } catch (error) {
            console.error('Failed to check access:', error);
        }
};

return (
  <div>
      <h1>Welcome to Digital DVD</h1>
      <LoginButton/>
      <LogoutButton/>
      <button type="button" onClick={handleCheckAccess}>
                Check Access
      </button>
      {showVideoButton && videoSrc && signedJWT && (
        <DemoPlayer src={videoSrc} jwt={signedJWT} />
      )}
  </div>
);

};

export default Home;
