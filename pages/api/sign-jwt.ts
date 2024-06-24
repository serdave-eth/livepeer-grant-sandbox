// Import necessary libraries and utilities
import { NextApiRequest, NextApiResponse } from 'next';
import { LitNodeClient, encryptString, decryptToString } from "@lit-protocol/lit-node-client";
import { AuthCallbackParams } from "@lit-protocol/types"
import { LitAbility, LitAccessControlConditionResource, LitActionResource, createSiweMessageWithRecaps, generateAuthSig } from "@lit-protocol/auth-helpers";
import {ethers} from 'ethers';
import { signAccessJwt } from "@livepeer/core/crypto";

export type CreateSignedPlaybackBody = {
  ciphertext: string;
  dataToEncryptHash: string;
  sessionSigs: any;
  videoPlayBack: any;
};

export type CreateSignedPlaybackResponse = {
  token: string;
};

interface signAccessJwt {
  privateKey?: any;
  publicKey?: any;
  issuer?: any;
  playbackId?: any;
  expiration?: any;
  custom?: any;
}

const chain = "ethereum";

// Private key for wallet to connect to Lit and decrypt message
const ethPrivateKey = process.env.ETH_PRIVATE_KEY as string;

// RPC endpoint for Lit client
const ethRpcUrl = process.env.ETH_RPC_URL;

// Expected decrypted string
const expectedKnownString = process.env.EXPECTED_DECRYPTED_STATEMENT;

// Expirate time for JWT
const ONE_WEEK_FROM_NOW = new Date(
  Date.now() + 1000 * 60 * 60 * 24 * 7
).toISOString();

// Livepeer public and private keys for signing JWTs
const accessControlPrivateKey = process.env.LIVEPEER_JWT_PRIVATE_KEY as string;
const accessControlPublicKey = process.env.LIVEPEER_JWT_PUBLIC_KEY as string;

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

// API handler for decrypting and verifying ciphertext
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { ciphertext, dataToEncryptHash, sessionSigs, videoPlayBack }: CreateSignedPlaybackBody = req.body;
    if (!ciphertext || !dataToEncryptHash || !videoPlayBack) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = new LitNodeClient({ litNetwork: 'cayenne' });
    await client.connect();

    const decryptedString = await decryptToString(
      {
        accessControlConditions,
        chain: chain,
        ciphertext,
        dataToEncryptHash,
        sessionSigs: sessionSigs,
      },
      client,
    );

    // Cross-check decrypted string against a known value
    if (decryptedString !== expectedKnownString) {
      throw new Error("Decrypted string does not match the known value");
    }
    
    const token = await signAccessJwt({
      privateKey: accessControlPrivateKey,
      publicKey: accessControlPublicKey,
      issuer: "https://docs.livepeer.org",
      playbackId: videoPlayBack,
      expiration: 3600,
    })

    await client.disconnect();

    res.status(200).json({ message: "Decryption successful. Signed JWT: ", token });
  } catch (error) {
    console.error('Decryption failed:', error);
    const message = (error as Error).message || 'Internal server error';
    res.status(500).json({ error: message });
  }
};

export default handler;
