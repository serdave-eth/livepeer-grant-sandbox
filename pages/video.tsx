import * as Player from "@livepeer/react/player";
import { getSrc } from "@livepeer/react/external";
import {Livepeer} from "livepeer";
import { GetStaticProps } from 'next';
import { DemoPlayer } from "../src/app/DemoPlayer";
import { Src } from "@livepeer/react";

export const getStaticProps: GetStaticProps = async (context) => {
  //create livepeer client
  const livepeer = new Livepeer({
    apiKey: process.env.LIVEPEER_SECRET_API_KEY,
  });

  const playbackId = "d3ff6iptj4i1ofzj";

  // Fetch playback info
  const playbackInfo = await livepeer.playback.get(playbackId);

  // Assuming getSrc is a function that processes playbackInfo to get a video source URL
  const src = getSrc(playbackInfo.playbackInfo);

  // Pass src as a prop to the page component
  return { props: { src }, revalidate: 3600 }; // revalidate every hour
};

const Video = ({ src }: { src: Src[] | null }) => {
  return (
    <div>
      {/* Here you could use the Livepeer player or any other video component */}
      <DemoPlayer src={src}/>
    </div>
  );
};

export default Video;
