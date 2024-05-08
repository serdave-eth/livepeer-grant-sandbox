import * as Player from "@livepeer/react/player";
import { Src } from "@livepeer/core/media";
import { PauseIcon, PlayIcon } from "@livepeer/react/assets";

type DemoPlayerProps = {
  src: Src[] | null;
  jwt?: string | null;
};

export const DemoPlayer = ({ src, jwt }: DemoPlayerProps) => {
  console.log("THIS IS THE JWT IN THE PLAYER: ", jwt);
  console.log("THIS IS THE PLAYBACK ID: ", src);
  return (
    <Player.Root src={src} jwt={jwt}>
      <Player.Container>
        <Player.Video />

        <Player.Controls className="flex items-center justify-center">
          <Player.PlayPauseTrigger className="w-10 h-10">
            <Player.PlayingIndicator asChild matcher={false}>
              <PlayIcon />
            </Player.PlayingIndicator>
            <Player.PlayingIndicator asChild>
              <PauseIcon />
            </Player.PlayingIndicator>
          </Player.PlayPauseTrigger>
        </Player.Controls>
      </Player.Container>
    </Player.Root>
  );
};
