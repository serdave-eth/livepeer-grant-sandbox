"use client"
import { useEffect, useState } from 'react';
import { disconnectWeb3 } from "@lit-protocol/auth-browser";
import { ethers } from 'ethers';  // Import Signer correctly
import { DemoPlayer } from "@/app/components/DemoPlayer";
import { Src } from '@livepeer/react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { LoginButton } from './components/LoginButton';
import { LogoutButton } from './components/LogoutButton';
import { getPlaybackInfo } from './utils/livepeerUtils';
import { init } from "./utils/litUtils";
import { getLitAuthData } from "./utils/litUtils";

//Inputs for calling Lit Action
const chain = "base";
const litActionIpfsId = 'QmabWSro8aL7rWYobXMANA5ppz9htoWFrhbCHUhAZEfDUv';

//Encrypted private key for signing JWT. Can only be decrypted by Lit Action
const ciphertext = 'sMQ/hgleWvrtuwpl6XgQoLmwnVSeylilJwAeLg7iRaYRQt0GIyWVH+9pGx5ZNn+j+A9+tBte+aVrnNnKJRurZPK1rFHkD4YIYoWtphXlsRfGAgex+VtILJecVJnbRAoaNgPha5vwklYtSp+t3JB1zEKuSfU5iUaicTmflOBMCDlRflSOhuqnVxDE09gfiT+5qr5ifKEEehOgGEvYoPf73QllbQY+1lV3ab1BgwvtwZfPAXjeva562iQ5rTpPNZZknlr8NJAq7lvbvn9yciljEVESo98AX5vJMr3AbX+gsMzw/XLjd29hd53P/mY/xEkcSfdnXoF+B+Y8zR/mJqgE4ZGRbpvzk10VsnaDVv9z7jKxf2Ob1sk3+vrfQ3hkmxShM1NYseQLQqpFbbDRQEvXXrwxmg0e0y/vW/uek16WA/FY8lYHxJeFrJwX0A00vUfqQKtCBcBbWfQP22IofgfYYCxn++lSCRQoBrV9h4rF37djTLtmI+sypaBk8EKy7Zm/yjWo9YNDCCtA3ziYCyYFzUb9yYGpmLCBAg==';
const dataToEncryptHash = 'd845034369ebeff68b40c8cb9eeb7898ef0e3af14533c3699b5b56f52d40f023';

//Video player input. Can use an Livepeer API Key. 
const livepeerApiKey = process.env.LIVEPEER_SECRET_API_KEY ?? "";
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
  //States for managing a basic UX
  const [showVideoButton, setShowVideoButton] = useState(false);
  const [videoSrc, setVideoSrc] = useState<Src[] | null>(null); // State to store video source
  const [signedJWT, setSignedJWT] = useState('');  // State to hold the signed JWT
  const [loading, setLoading] = useState(false);  // State to handle loading
  const [errorMessage, setErrorMessage] = useState('');

  //Privy globals
  const { authenticated} = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0];

  //Logic for making sure Lit client doesn't stay open between loads
  useEffect(() => {
    // Call disconnectWeb3 when the component mounts
    disconnectWeb3();
    console.log('Disconnected Web3 provider on component mount.');
  }, []); // Empty dependency array ensures this effect runs only once on mount

  //Logic for showing the video player if Lit Action works (aka you get a signed JWT)
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

  //Logic for UX when you log out
  useEffect(() => {
    // Reset state when user logs out
    if (!authenticated) {
      setShowVideoButton(false);
      setSignedJWT('');
      setVideoSrc(null);
    }
  }, [authenticated]);

  //Creates authsig and session sig, then calls the Lit Action to retrieve signed JWT
  const handleCheckAccess = async () => {
    try {
      setLoading(true);

      // Get the user's wallet signer
      const userSigner = await userWallet.getEthereumProvider();
      const provider = new ethers.providers.Web3Provider(userSigner);
      const signer = provider.getSigner();
      const address = await signer.getAddress();


      // Initialize Keypo
      const keypo = await init(address);

      // Get Lit auth data for the file (replace "livepeer-jwt" with your file key if needed)
      const { sessionSigs, authSig, litNodeClient } = await getLitAuthData("livepeer-jwt", keypo, signer as any);

      // Get file info from Keypo
      const file = keypo.files["livepeer-jwt"];
      const dataToEncryptHash = file.fileIdentifier;

      // Fetch file JSON from IPFS
      const ipfsPacket = await fetch(`https://gateway.pinata.cloud/ipfs/${file.cid}`);
      const fileJson = await ipfsPacket.json();
      const ciphertext = fileJson.ciphertext;
      const litActionIpfsId = fileJson.userField.litActionCid;
      const chain = "ethereum";

      // Build access control conditions
      const accessControlConditions = [
        {
          contractAddress: "",
          standardContractType: "",
          chain,
          method: "",
          parameters: [":currentActionIpfsId"],
          returnValueTest: {
            comparator: "=",
            value: litActionIpfsId,
          },
        },
      ];

      // Call Lit Action via LitNodeClient
      const res = await litNodeClient.executeJs({
        sessionSigs,
        ipfsId: litActionIpfsId,
        jsParams: {
          accessControlConditions,
          ciphertext,
          dataToEncryptHash,
          authSig,
          chain,
        },
      });

      // The signed JWT is in res.response
      let jwtObj;
      if (typeof res.response === "string") {
        jwtObj = JSON.parse(res.response);
      } else {
        jwtObj = res.response;
      }
      setSignedJWT(jwtObj.Response);
      setErrorMessage("");
    } catch (error) {
      console.error("Failed to check access:", error);
      setErrorMessage("ERROR: Access Denied");
    } finally {
      setLoading(false);
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
            Go <a href="https://www.keypo.io/app/claim/0x9c871e5b7eee09535ecfe824d659fb5faf835d45" target="_blank" rel="noopener noreferrer" style={{ color: '#0000EE' }}>here</a> to mint the NFT needed to watch the video.
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
