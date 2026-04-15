import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("BoxMath", function () {
  async function deploy() {
    return ethers.deployContract("BoxMath");
  }

  // --- Monomial ---

  it("Monomial: degree of xy is 2", async function () {
    const bm = await deploy();
    const xy = { coefficient: 1n, exponents: [1n, 1n] };
    expect(await bm.monomialDegree(xy)).to.equal(2n);
  });

  it("Monomial: evaluates at point (xy at [10,20] = 200)", async function () {
    const bm = await deploy();
    const xy = { coefficient: 1n, exponents: [1n, 1n] };
    expect(await bm.evaluateMonomial(xy, [10n, 20n])).to.equal(200n);
  });

  it("Monomial: multiply x · y = xy", async function () {
    const bm = await deploy();
    const x = { coefficient: 1n, exponents: [1n] };
    const y = { coefficient: 1n, exponents: [0n, 1n] };
    const [coeff, exps] = await bm.multiplyMonomials(x, y);
    expect(coeff).to.equal(1n);
    expect(exps.map(BigInt)).to.deep.equal([1n, 1n]);
  });

  // --- MultiPoly ---

  it("MultiPoly: constant product k = xy evaluates at [100,200] = 20000", async function () {
    const bm = await deploy();
    const k = { terms: [{ coefficient: 1n, exponents: [1n, 1n] }] };
    expect(await bm.evaluateMultiPoly(k, [100n, 200n])).to.equal(20000n);
  });

  it("MultiPoly: linear f(x,y,z)=2x+3y+5z at [1,2,3] = 23", async function () {
    const bm = await deploy();
    const f = {
      terms: [
        { coefficient: 2n, exponents: [1n, 0n, 0n] },
        { coefficient: 3n, exponents: [0n, 1n, 0n] },
        { coefficient: 5n, exponents: [0n, 0n, 1n] },
      ],
    };
    expect(await bm.evaluateMultiPoly(f, [1n, 2n, 3n])).to.equal(23n);
  });

  it("MultiPoly: truncate drops terms above degree k", async function () {
    const bm = await deploy();
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const addr = await bm.getAddress();

    const p = {
      terms: [
        { coefficient: 2n, exponents: [0n, 0n] },
        { coefficient: 3n, exponents: [1n, 0n] },
        { coefficient: 1n, exponents: [2n, 0n] },
      ],
    };

    // explicit encode → raw call → explicit decode with unnamed tuples
    // avoids ethers named-property assignment bug on single-element Result arrays
    const calldata = bm.interface.encodeFunctionData("truncate", [p, 1n]);
    const raw = await ethers.provider.call({ to: addr, data: calldata });
    const [[terms]] = coder.decode(["((uint256,uint256[])[])"], raw);

    expect(terms.length).to.equal(2);

    const truncated = {
      terms: Array.from(terms as any[]).map((t: any) => ({
        coefficient: t[0] as bigint,
        exponents: Array.from(t[1] as bigint[]),
      })),
    };
    expect(await bm.evaluateMultiPoly(truncated, [5n])).to.equal(17n); // 2 + 3·5 = 17
  });

  it("caretProduct: FIA box from BoxMathPrimes exercise 8.1", async function () {
    const bm = await deploy();
    const boxes = [
      [1n, 2n],
      [1n, 3n],
      [1n, 5n],
      [1n, 7n],
      [1n, 11n],
    ];
    const M = await bm.caretProduct(boxes);
    expect(M.length).to.equal(32);                       // 2^5 elements
    expect(M).to.include(2310n);                         // max: 2·3·5·7·11
    expect(M).to.include(1n);                            // identity present
    expect(M.every((n: bigint) => n > 0n)).to.be.true;  // all natural numbers
  });

  it("MultiPoly: multiplication (Wildberger) yields 6 terms", async function () {
    const bm = await deploy();
    const B = {
      terms: [
        { coefficient: 1n, exponents: [] },
        { coefficient: 1n, exponents: [0n, 0n, 0n, 1n] },
        { coefficient: 1n, exponents: [0n, 0n, 1n, 0n, 1n] },
      ],
    };
    const C = {
      terms: [
        { coefficient: 1n, exponents: [0n, 2n] },
        { coefficient: 1n, exponents: [0n, 0n, 1n, 0n, 1n] },
      ],
    };
    const product = await bm.multiplyMultiPoly(B, C);
    expect(product.terms.length).to.equal(6);
  });
});
