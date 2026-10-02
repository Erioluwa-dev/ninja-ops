export interface SpritesheetAsset {
  readonly type: "spritesheet";
  readonly key: string;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

export interface ImageAsset {
  readonly type: "image";
  readonly key: string;
  readonly url: string;
}

export type AssetEntry = SpritesheetAsset | ImageAsset;
