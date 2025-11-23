declare module "js-aruco2" {
  export namespace AR {
    interface Point2 {
      x: number
      y: number
    }

    interface Marker {
      id: number
      corners: Point2[]
    }

    interface DetectorOptions {
      dictionaryName?: 'ARUCO' | 'ARUCO_MIP_36h12';
      maxHammingDistance?: number
    }

    type StreamCallback = (image: ImageData, markerList: Marker[]) => void

    class Detector {
      constructor(options?: DetectorOptions)
      detect(imageData: ImageData): Marker[]
      detect(width: number, height: number, data: Uint8ClampedArray | ArrayBufferLike): Marker[]
      detectStreamInit(width: number, height: number, callback: StreamCallback): void
      detectStream(data: Uint8ClampedArray | ArrayBufferLike): void
    }

    interface DictionaryDefinition {
      nBits: number
      tau?: number
      codeList: string[]
    }

    class Dictionary {
      constructor(name: string)
      generateSVG(id: number): string
    }

    const DICTIONARIES: {
      [name: string]: DictionaryDefinition
    }
  }

  export namespace POS {
    interface Pose {
      bestError: number
      bestRotation: number[][]
      bestTranslation: number[]
      alternativeError: number
      alternativeRotation: number[][]
      alternativeTranslation: number[]
    }

    class Posit {
      constructor(modelSize: number, focalLength: number)
      pose(corners: AR.Point2[]): Pose
    }
  }

  export const AR: typeof AR
  export const POS: typeof POS
}
