import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import { Livepeer } from "livepeer";
import { DemoPlayer } from "@/app/components/DemoPlayer";
import { Src } from "@livepeer/react";

// Function to fetch signed JWT token with absolute URL
async function fetchSignedToken(playbackId: string, secret: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sign-jwt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playbackId, secret }),
    });

    if (!response.ok) {
      console.error(`API error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error(`Fetch error: ${error}`);
    return null;
  }
}

// Server function to fetch playback info
async function getPlaybackInfo(playbackId: string) {
  const livepeer = new Livepeer({
    apiKey: process.env.LIVEPEER_SECRET_API_KEY!,
  });

  const playbackInfo = await livepeer.playback.get(playbackId);
  return getSrc(playbackInfo.playbackInfo);
}

// Asynchronous server component fetching playback data
export default async function VideoPage() {
  const playbackId = "cc53eb8slq3hrhoi";
  const src = await getPlaybackInfo(playbackId);
  console.log("SOURCE: ", src);

  // Fetch JWT token during server-side rendering
  const jwtToken = await fetchSignedToken(playbackId, 'supersecretkey');

  if (!jwtToken) {
    return <p>Failed to fetch JWT token.</p>;
  }

  return (
    <div>
      <DemoPlayer src={src}/>
    </div>
  );
}
