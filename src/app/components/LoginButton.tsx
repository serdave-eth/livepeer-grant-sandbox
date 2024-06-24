import {usePrivy} from '@privy-io/react-auth';

export const LoginButton = () => {
  const { ready, authenticated, login } = usePrivy();
  
  // Disable the button if Privy is not ready or if the user is already authenticated
  const disableLogin = !ready || authenticated;

  return (
    <button disabled={disableLogin} onClick={login}>
      Log in
    </button>
  );
};


