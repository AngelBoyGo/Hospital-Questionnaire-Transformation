class FeasibilityScorer {
  constructor() {
    this.weights = {
      technical: 0.25,
      regulatory: 0.20,
      resource: 0.20,
      vendor: 0.15,
      risk: 0.10,
      change: 0.10
    };
  }

  score(features) {
    const {
      technical = 1,
      regulatory = 1,
      resource = 1,
      vendor = 1,
      risk = 1,
      change = 1
    } = features || {};
    const s = (
      technical * this.weights.technical +
      regulatory * this.weights.regulatory +
      resource * this.weights.resource +
      vendor * this.weights.vendor +
      risk * this.weights.risk +
      change * this.weights.change
    );
    return Math.max(0, Math.min(1, s));
  }
}

module.exports = { FeasibilityScorer };


