'use client';

import { useEffect } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { baseSepolia } from 'viem/chains';

export const PrivyWrapper = ({ children }: { children: React.ReactNode }) => {
  // Use useEffect to log when the component mounts
  useEffect(() => {
    console.log("PrivyWrapper loaded and PrivyProvider is now wrapping the app.");
  }, []);

  return (
    <PrivyProvider
      appId="clxnzww0l02bl29rq6jnddkwt"
      config={{
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia]
      }}>
      {children}
    </PrivyProvider>
  );
}
