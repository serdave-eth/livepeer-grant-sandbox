import { useState } from 'react';
import { GetStaticProps, GetStaticPropsContext } from 'next';
import * as Player from '@livepeer/react/player';
import { getSrc } from '@livepeer/react/external';
import { DemoPlayer } from '../src/app/DemoPlayer';
import { Src } from '@livepeer/react';

interface VideoProps {
  src: Src[] | null;
}

export const getStaticProps: GetStaticProps<VideoProps> = async (context: GetStaticPropsContext) => {
  const { playbackId } = context.params || { playbackId: '' };

  // Replace this with your actual API key
  const livepeer = new (await import('livepeer')).Livepeer({
    apiKey: process.env.LIVEPEER_SECRET_API_KEY,
  });

  const playbackInfo = await livepeer.playback.get(playbackId as string);
  const src = getSrc(playbackInfo.playbackInfo);

  return { props: { src }, revalidate: 3600 }; // revalidate every hour
};

const Video = ({ src }: VideoProps) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [playbackId, setPlaybackId] = useState<string | null>(null);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault(); // Prevent default form submission behavior

    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (response.status === 200) {
      const { success, playbackId } = await response.json();
      if (success) {
        setIsAuthenticated(true);
        setPlaybackId(playbackId);
        setError('');
      } else {
        setError('Incorrect password. Please try again.');
      }
    } else {
      setError('Failed to reach the server. Please try again later.');
    }
  };

  return (
    <div>
      {!isAuthenticated ? (
        <div>
          <h1>Please Enter the Password to Access the Video</h1>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter password"
          />
          <button type="button" onClick={handleSubmit}>
            Enter
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <DemoPlayer src={src} />
      )}
    </div>
  );
};

export default Video;
``
