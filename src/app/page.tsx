"use client"
import { useEffect, useState } from 'react';
import { LitNetwork } from "@lit-protocol/constants";
import { disconnectWeb3 } from "@lit-protocol/auth-browser";
import { LitNodeClient, encryptString} from "@lit-protocol/lit-node-client";
import { LitAbility, LitAccessControlConditionResource, LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from "@lit-protocol/auth-helpers";
import { ethers, Signer } from 'ethers';  // Import Signer correctly
import { getSrc } from "@livepeer/react/external";
import { Livepeer } from "livepeer";
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

const chain = "base";

const livepeerApiKey = process.env.LIVEPEER_SECRET_API_KEY ?? "";

//Source string is encrypted using access control condition that you hold a specific ERC721 NFT
//then on server side is decrypted using same access control condition, and cross-checked with
//original source string
const source_string = "Livepeer Grant P1";

//Playback ID of token gated video. Only works if you have signed JWT from API end point
const playbackId = "cc53eb8slq3hrhoi";

const accessControlConditions = [
  {
    contractAddress: '0x13dfaF990cE5176e01dcaDc932EB71756072DB27',
    standardContractType: 'ERC721',
    chain: chain,
    method: 'balanceOf',
    parameters: [
      ':userAddress'
    ],
    returnValueTest: {
      comparator: '>',
      value: '0'
    }
  }
]

// Function to fetch playback info
/*async function getPlaybackInfo(playbackId: string) {
  const api_key = process.env.LIVEPEER_SECRET_API_KEY;
  const livepeer = new Livepeer({apiKey: api_key});
  const playbackInfo = await livepeer.playback.get(playbackId);
  return getSrc(playbackInfo.playbackInfo);
}*/

const Home = () => {
  const [showVideoButton, setShowVideoButton] = useState(false);
  const [videoSrc, setVideoSrc] = useState<Src[] | null>(null); // State to store video source
  const [signedJWT, setSignedJWT] = useState('');  // State to hold the signed JWT
  const [loading, setLoading] = useState(false);  // State to handle loading
  const [errorMessage, setErrorMessage] = useState('');

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

  useEffect(() => {
    // Reset state when user logs out
    if (!authenticated) {
      setShowVideoButton(false);
      setSignedJWT('');
      setVideoSrc(null);
    }
  }, [authenticated]);

  const handleCheckAccess = async () => {
        try {
            setLoading(true);  // Start loading
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
          //const uri = "https://livepeer-grant-sandbox.vercel.app/"; // Explicitly set the URI here
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
            ]); // Pass the URI here
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
          if (data.token) {
            setSignedJWT(data.token);
            setErrorMessage('');
          }
        } catch (error) {
          console.error('Failed to check access:', error);
          setErrorMessage('ERROR: Access Denied');
        }
        finally {
          setLoading(false);  // Stop loading regardless of the outcome
        }
        const handleLogout = async () => {
          try {
            // Add your code to disconnect from Lit Node Client here if needed
            console.log('Disconnecting from Lit Node Client...');
            // Reset JWT
            setSignedJWT('');
            console.log('Logged out successfully.');
          } catch (error) {
            console.error('Failed to log out:', error);
          }
        };
};

return (
  <div>
      <h1 style={{ textAlign: 'center', fontSize: '36px', marginTop: '20px', fontWeight: 'bold' }}>
        Welcome to Digital DVD
      </h1>
      <div style={{ maxWidth: '600px', margin: 'auto', textAlign: 'center' }}>
        <div style={{ marginTop: '20px' }}>
          <strong>Step 1: Mint Access NFT</strong><br />
          Go <a href="https://app.manifold.xyz/c/livepeergranttest" target="_blank" rel="noopener noreferrer" style={{ color: '#0000EE' }}>here</a> to mint the NFT needed to watch the video.
        </div>
        <div style={{ marginTop: '20px' }}>
          <strong>Step 2: Connect Wallet</strong>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px' }}>
            <LoginButton/>
            <LogoutButton/>
          </div>
        </div>
        <div style={{ marginTop: '20px' }}>
          <strong>Step 3: Check Access</strong>
          <p>Press the button below. You will be asked to sign a message with your wallet, after which we will check if you have permission to view the video. If you do, the video player will appear below.</p>
          <button type="button" onClick={handleCheckAccess} style={{ display: 'block', margin: '20px auto', background: 'grey', border: 'none', borderRadius: '8px', padding: '10px 20px', color: 'white', cursor: 'pointer' }}>
            {loading ? 'Checking...' : 'Check Access'}
          </button>
        </div>
        {errorMessage && (
          <div style={{ color: 'red', marginTop: '20px' }}>{errorMessage}</div>
        )}
        {showVideoButton && videoSrc && signedJWT && authenticated && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DemoPlayer src={videoSrc} jwt={signedJWT} />
          </div>
        )}
      </div>
  </div>
);

};

export default Home;
