import type { Bike, Paint } from './types';

export function paintsForBike(bike: Bike): Paint[] {
  return [
    {
      id: 'default',
      name: bike.color,
      hex: bike.colorHex,
      image: bike.image,
      source: bike.imageSource || bike.source,
      imageRatio: bike.imageRatio,
      imageFit: bike.imageFit,
      imagePosition: bike.imagePosition,
      imageTone: bike.imageTone,
      note: bike.imageNote,
    },
    ...(bike.paints || []),
  ];
}
