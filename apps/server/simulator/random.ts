/** Reproducible pseudo-randomness for test data, NOT security or production gameplay. */
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new Error('seed must be an integer');
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  index(length: number): number {
    if (!Number.isInteger(length) || length < 1) throw new Error(`Invalid random range: ${length}`);
    return Math.floor(this.next() * length);
  }
  die(): number { return this.index(6) + 1; }
}
