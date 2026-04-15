import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("PixelMath", function () {
  async function deploy() {
    return ethers.deployContract("PixelMath");
  }

  // --- Pixel product ---

  it("Pixel: pixelProduct [3,4]·[4,11] = [3,11]", async function () {
    const pm = await deploy();
    const [ok, result] = await pm.pixelProduct({ m: 3n, n: 4n }, { m: 4n, n: 11n });
    expect(ok).to.equal(true);
    expect(result.m).to.equal(3n);
    expect(result.n).to.equal(11n);
  });

  it("Pixel: pixelProduct is nothing when inner indices mismatch", async function () {
    const pm = await deploy();
    const [ok] = await pm.pixelProduct({ m: 3n, n: 4n }, { m: 5n, n: 11n });
    expect(ok).to.equal(false);
  });

  it("Pixel: pixelProduct is associative", async function () {
    const pm = await deploy();
    const a = { m: 1n, n: 2n };
    const b = { m: 2n, n: 3n };
    const c = { m: 3n, n: 4n };

    const [, abRaw] = await pm.pixelProduct(a, b);
    const ab = { m: abRaw.m, n: abRaw.n };
    const [lhsOk, lhs] = await pm.pixelProduct(ab, c);

    const [, bcRaw] = await pm.pixelProduct(b, c);
    const bc = { m: bcRaw.m, n: bcRaw.n };
    const [rhsOk, rhs] = await pm.pixelProduct(a, bc);

    expect(lhsOk).to.equal(true);
    expect(rhsOk).to.equal(true);
    expect(lhs.m).to.equal(rhs.m);
    expect(lhs.n).to.equal(rhs.n);
  });

  it("Pixel: transpose [3,7]^T = [7,3]", async function () {
    const pm = await deploy();
    const t = await pm.pixelTranspose({ m: 3n, n: 7n });
    expect(t.m).to.equal(7n);
    expect(t.n).to.equal(3n);
  });

  it("Pixel: (ab)^T = b^T · a^T", async function () {
    const pm = await deploy();
    const a = { m: 2n, n: 5n };
    const b = { m: 5n, n: 9n };

    const [, abRaw] = await pm.pixelProduct(a, b);
    const abT = await pm.pixelTranspose({ m: abRaw.m, n: abRaw.n });

    const bTRaw = await pm.pixelTranspose(b);
    const aTRaw = await pm.pixelTranspose(a);
    const bT = { m: bTRaw.m, n: bTRaw.n };
    const aT = { m: aTRaw.m, n: aTRaw.n };
    const [, bTaT] = await pm.pixelProduct(bT, aT);

    expect(abT.m).to.equal(bTaT.m);
    expect(abT.n).to.equal(bTaT.n);
  });

  it("Pixel: [3,3] is diagonal, [3,4] is not", async function () {
    const pm = await deploy();
    expect(await pm.pixelIsDiagonal({ m: 3n, n: 3n })).to.equal(true);
    expect(await pm.pixelIsDiagonal({ m: 3n, n: 4n })).to.equal(false);
  });

  // --- Pythagorean / Babylonian triples ---

  const triples: [bigint, bigint, bigint, bigint, bigint][] = [
    [2n, 1n, 3n, 4n, 5n],
    [3n, 2n, 5n, 12n, 13n],
    [4n, 1n, 15n, 8n, 17n],
    [4n, 3n, 7n, 24n, 25n],
    [5n, 2n, 21n, 20n, 29n],
  ];

  for (const [m, n, a, b, c] of triples) {
    it(`Pythagorean triple: pixel [${m},${n}] → (${a}, ${b}, ${c})`, async function () {
      const pm = await deploy();
      const [ok, ta, tb, tc] = await pm.pythagoreanTriple({ m, n });
      expect(ok).to.equal(true);
      expect(ta).to.equal(a);
      expect(tb).to.equal(b);
      expect(tc).to.equal(c);
      // verify on-chain: a² + b² = c²
      expect(ta * ta + tb * tb).to.equal(tc * tc);
    });
  }

  it("Pythagorean triple: returns false when m <= n", async function () {
    const pm = await deploy();
    const [ok] = await pm.pythagoreanTriple({ m: 2n, n: 2n });
    expect(ok).to.equal(false);
  });

  // --- Vexel ---

  // --- Maxel ---

  it("Maxel: transpose transposes every pixel", async function () {
    const pm = await deploy();
    // M = 2[0,0] + [1,0] + 3[0,2]  → M^T = 2[0,0] + [0,1] + 3[2,0]
    const M = [
      { pixel: { m: 0n, n: 0n }, coeff: 2n },
      { pixel: { m: 1n, n: 0n }, coeff: 1n },
      { pixel: { m: 0n, n: 2n }, coeff: 3n },
    ];
    const MT = await pm.maxelTranspose(M);
    // collect as map for easy assertion
    const map = new Map(MT.map((e: { pixel: { m: bigint; n: bigint }; coeff: bigint }) =>
      [`${e.pixel.m},${e.pixel.n}`, e.coeff]
    ));
    expect(map.get('0,0')).to.equal(2n);
    expect(map.get('0,1')).to.equal(1n);  // [1,0]^T = [0,1]
    expect(map.get('2,0')).to.equal(3n);  // [0,2]^T = [2,0]
  });

  it("Maxel: maxelProduct — Example 22: MN = [0,2] + [1,2]", async function () {
    const pm = await deploy();
    const M = [
      { pixel: { m: 0n, n: 0n }, coeff: 1n },
      { pixel: { m: 1n, n: 0n }, coeff: 1n },
    ];
    const N = [
      { pixel: { m: 1n, n: 0n }, coeff: 1n },
      { pixel: { m: 0n, n: 2n }, coeff: 1n },
      { pixel: { m: 2n, n: 3n }, coeff: 1n },
    ];
    const MN = await pm.maxelProduct(M, N);
    const map = new Map(MN.map((e: { pixel: { m: bigint; n: bigint }; coeff: bigint }) =>
      [`${e.pixel.m},${e.pixel.n}`, e.coeff]
    ));
    expect(map.get('0,2')).to.equal(1n);
    expect(map.get('1,2')).to.equal(1n);
    expect(map.size).to.equal(2);
  });

  it("Maxel: maxelProduct — Example 23: MN = 29[0,1] + 4[1,1]", async function () {
    const pm = await deploy();
    const M = [
      { pixel: { m: 0n, n: 0n }, coeff: 2n },
      { pixel: { m: 1n, n: 0n }, coeff: 1n },
      { pixel: { m: 0n, n: 2n }, coeff: 3n },
    ];
    const N = [
      { pixel: { m: 1n, n: 0n }, coeff: 1n },
      { pixel: { m: 0n, n: 1n }, coeff: 4n },
      { pixel: { m: 2n, n: 1n }, coeff: 7n },
      { pixel: { m: 3n, n: 2n }, coeff: 5n },
    ];
    const MN = await pm.maxelProduct(M, N);
    const map = new Map(MN.map((e: { pixel: { m: bigint; n: bigint }; coeff: bigint }) =>
      [`${e.pixel.m},${e.pixel.n}`, e.coeff]
    ));
    expect(map.get('0,1')).to.equal(29n);
    expect(map.get('1,1')).to.equal(4n);
    expect(map.size).to.equal(2);
  });

  // --- Vexel ---

  it("Vexel: add merges coefficients", async function () {
    const pm = await deploy();
    const result = await pm.vexelAdd([1n, 2n, 0n], [0n, 3n, 4n]);
    expect(result.map(BigInt)).to.deep.equal([1n, 5n, 4n]);
  });

  it("Vexel: add pads shorter vector with zeros", async function () {
    const pm = await deploy();
    const result = await pm.vexelAdd([1n, 2n], [0n, 3n, 4n]);
    expect(result.map(BigInt)).to.deep.equal([1n, 5n, 4n]);
  });

  it("Vexel: scale multiplies all coefficients", async function () {
    const pm = await deploy();
    const result = await pm.vexelScale([1n, 2n, 3n], 3n);
    expect(result.map(BigInt)).to.deep.equal([3n, 6n, 9n]);
  });

  it("Vexel: dot product (1,2,3)·(4,5,6) = 32", async function () {
    const pm = await deploy();
    expect(await pm.vexelDot([1n, 2n, 3n], [4n, 5n, 6n])).to.equal(32n);
  });
});
