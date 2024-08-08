"use client"
import { useEffect, useState } from 'react';
import { disconnectWeb3 } from "@lit-protocol/auth-browser";
import { LitAbility, LitAccessControlConditionResource, LitActionResource} from "@lit-protocol/auth-helpers";
import { ethers } from 'ethers';  // Import Signer correctly
import { DemoPlayer } from "@/app/components/DemoPlayer";
import { Src } from '@livepeer/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { LoginButton } from './components/LoginButton';
import { LogoutButton } from './components/LogoutButton';
import { getLitNodeClient, genSession, genAuthSig } from './utils/litUtils';
import { getPlaybackInfo } from './utils/livepeerUtils';
import * as siwe from 'siwe';

const chain = "base";
const litActionIpfsId = 'QmWA1StRHhyLVredACLN7vra35Dyv4jUSQ5rzsVhovLcf4';
const ciphertext = 's/XIL+d7AMGCLngpzu/y/mmKox2xfOgoNKWfSyfLHTqrP2wUx9z1kiBqeCsYLQUuj6JFQZXeL7orZOwn2joiyisIZ+DYIjZc1czK/8xrl8vGAnpE34O4q0193aBC1yCMXRnHxbcpAnEnT0IxOn/Hx5jvh8sBy6QoCpP0H2SNVOUY3fpraQwO+Z8/L4jR89fzDbqSPwHXpkaPnadBSuiV140rndQEQYyEJRzUfkDPeC/heZUjuY0V+9kZcYoZiW1GD9FCAHA4eCzN5N+udh/B0srcInmBypO0PfnVX+WEHgoDUz2sMrytTQQaGCZKYVr9PTbjksVK7MJ1oQx6nyq+/p2EozBODoA7MUaZpXyRhY9CsgTQlmDXahnlUEidfNKTzkNGaYX9CxIpZWB6wtvu2HU7MPT4WlLTCAnAvW0pWgz/1D4OG1XEdyv9GbPKU51Ty6AmHL9DaKkb/KSlnXb0ZUExMxVfGzF7/tlnU3acjD7mhZX2VcnV8B5SkYG6HDysYrYL9GSvvFL7r5P+i+LnmUb0Ew/PgfvBAg==';
const dataToEncryptHash = 'e3d31f0824b9b959a28f374d993279a4a182917fd335374a718611e790239f4b';
const livepeerApiKey = process.env.LIVEPEER_SECRET_API_KEY ?? "";

//Playback ID of token gated video. Only works if you have signed JWT from API end point
const playbackId = "cc53eb8slq3hrhoi";

const accessControlConditions = [
  {
    contractAddress: '',
    standardContractType: '',
    chain: chain,
    method: '',
    parameters: [':currentActionIpfsId'],
    returnValueTest: {
      comparator: '=',
      value: litActionIpfsId,
    },
  },
];

const Home = () => {
  const [showVideoButton, setShowVideoButton] = useState(false);
  const [videoSrc, setVideoSrc] = useState<Src[] | null>(null); // State to store video source
  const [signedJWT, setSignedJWT] = useState('');  // State to hold the signed JWT
  const [loading, setLoading] = useState(false);  // State to handle loading
  const [errorMessage, setErrorMessage] = useState('');

  const { authenticated} = usePrivy();
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
          //const uri = "https://livepeer-grant-sandbox.vercel.app/"; // Explicitly set the URI here
          const accsResourceString = 
        await LitAccessControlConditionResource.generateResourceString(accessControlConditions as any, dataToEncryptHash);
          const userSigner = await userWallet.getEthereumProvider();
          // Wrap the EIP-1193 provider with ethers
          const provider = new ethers.providers.Web3Provider(userSigner);

          // Get the signer from the ethers provider
          const signer = provider.getSigner();
          let sessionForDecryption;  
          const resources = [
            {
                resource: new LitActionResource('*'),
                ability: LitAbility.LitActionExecution,
            },
            {
                resource: new LitAccessControlConditionResource(accsResourceString),
                ability: LitAbility.AccessControlConditionDecryption,
    
            }
        ];
          if(userSigner) {
            sessionForDecryption = await genSession(signer, litNodeClient, resources);
          console.log("session sigs: ", sessionForDecryption);
          }

            // Use genAuthSig function
            const authSig = await genAuthSig(signer, litNodeClient, origin, resources);
            console.log(authSig);
            const res = await litNodeClient.executeJs({
                sessionSigs: sessionForDecryption,
                //code: genActionSource(),
                ipfsId: litActionIpfsId,
                jsParams: {
                    accessControlConditions,
                    ciphertext,
                    dataToEncryptHash,
                    authSig: authSig,
                    chain
                }
              });
              console.log("result from action execution: ", res);
          // Check if res.response is a non-empty string
          if (typeof res.response === 'string' && res.response.trim() !== '') {
              setSignedJWT(res.response);  // Update the JWT
              setErrorMessage('');  // Clear any error messages
          } else {
              setErrorMessage('ERROR: Access Denied');  // Handle the empty string case
            }
          } catch (error) {
              console.error('Failed to check access:', error);
              setErrorMessage('ERROR: Access Denied');  // Handle the error case
          } finally {
              setLoading(false);  // Stop loading regardless of the outcome
          }
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
