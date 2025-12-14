export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface PageViewport {
  width: number;
  height: number;
  scale: number;
}

export enum AppStep {
  UPLOAD = 'UPLOAD',
  SIGNATURE = 'SIGNATURE',
  PLACE = 'PLACE',
  SUCCESS = 'SUCCESS',
}

export interface SignatureData {
  dataUrl: string;
  width: number;
  height: number;
}
