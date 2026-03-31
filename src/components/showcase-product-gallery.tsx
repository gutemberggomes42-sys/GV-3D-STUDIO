/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Play } from "lucide-react";

type ShowcaseProductGalleryProps = {
  images: string[];
  videoUrl?: string;
  productName: string;
};

export function ShowcaseProductGallery({ images, videoUrl, productName }: ShowcaseProductGalleryProps) {
  const mediaItems = [
    ...(videoUrl ? [{ type: "video" as const, url: videoUrl, poster: images[0] ?? "" }] : []),
    ...images.map((imageUrl) => ({ type: "image" as const, url: imageUrl, poster: imageUrl })),
  ];
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const selectedMedia = mediaItems[selectedMediaIndex];

  return (
    <div className="space-y-4">
      {selectedMedia?.type === "video" ? (
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/25">
          <video
            src={selectedMedia.url}
            className="h-[360px] w-full object-cover sm:h-[460px]"
            controls
            playsInline
            preload="metadata"
            poster={selectedMedia.poster}
          >
            Seu navegador não suporta vídeo.
          </video>
        </div>
      ) : selectedMedia?.type === "image" ? (
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/25">
          <img
            src={selectedMedia.url}
            alt={productName}
            className="h-[360px] w-full object-cover sm:h-[460px]"
          />
        </div>
      ) : null}

      {mediaItems.length > 1 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {mediaItems.map((mediaItem, index) => {
            const active = index === selectedMediaIndex;

            return (
              <button
                key={`${mediaItem.type}-${mediaItem.url}`}
                type="button"
                onClick={() => setSelectedMediaIndex(index)}
                className={`overflow-hidden rounded-[22px] border transition ${
                  active
                    ? "border-orange-400/70 bg-orange-500/10"
                  : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <div className="relative">
                  <img
                    src={mediaItem.poster}
                    alt={productName}
                    className="h-20 w-full object-cover sm:h-24"
                  />
                  {mediaItem.type === "video" ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur">
                        <Play className="h-4 w-4 fill-current" />
                      </span>
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
