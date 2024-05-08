import { signAccessJwt } from "@livepeer/core/crypto";
import { NextApiRequest, NextApiResponse } from "next";
import { ApiError } from "next/dist/server/api-utils";

export type CreateSignedPlaybackBody = {
  playbackId: string;
  secret: string;
};

export type CreateSignedPlaybackResponse = {
  token: string;
};

const accessControlPrivateKey = process.env.LIVEPEER_JWT_PRIVATE_KEY;
const accessControlPublicKey = process.env.LIVEPEER_JWT_PUBLIC_KEY;

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<CreateSignedPlaybackResponse | ApiError>
) => {
  try {
    const method = req.method;

    if (method === "POST") {
      if (!accessControlPrivateKey || !accessControlPublicKey) {
        throw new ApiError(500, "No private/public key configured.");
      }

      const { playbackId, secret }: CreateSignedPlaybackBody = req.body;

      if (!playbackId || !secret) {
        throw new ApiError(400, "Missing data in body.");
      }

      if (secret !== "supersecretkey") {
        throw new ApiError(401, "Incorrect secret.");
      }

      const token = await signAccessJwt({
        privateKey: accessControlPrivateKey,
        publicKey: accessControlPublicKey,
        issuer: "https://docs.livepeer.org",
        playbackId,
        expiration: 3600,
        custom: {
          userId: "user-id-1",
        },
      });

      return res.status(200).json({ token });
    }

    res.setHeader("Allow", ["POST"]);
    throw new ApiError(405, `Method ${method} Not Allowed`);
  } catch (err) {
    console.error(err);
    return res.status(500).json(new ApiError(500, (err as Error)?.message ?? "Error"));
  }
};

export default handler;
