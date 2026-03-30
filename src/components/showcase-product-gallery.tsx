/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

type ShowcaseProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ShowcaseProductGallery({ images, productName }: ShowcaseProductGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(images[0]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/25">
        <img
          src={selectedImage}
          alt={productName}
          className="h-[360px] w-full object-cover sm:h-[460px]"
        />
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((imageUrl) => {
            const active = imageUrl === selectedImage;

            return (
              <button
                key={imageUrl}
                type="button"
                onClick={() => setSelectedImage(imageUrl)}
                className={`overflow-hidden rounded-[22px] border transition ${
                  active
                    ? "border-orange-400/70 bg-orange-500/10"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <img
                  src={imageUrl}
                  alt={productName}
                  className="h-20 w-full object-cover sm:h-24"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
