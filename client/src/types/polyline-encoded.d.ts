declare module 'polyline-encoded' {
  const polyline: {
    decode(encoded: string): [number, number][];
    encode(coordinates: [number, number][]): string;
  };
  export default polyline;
}
