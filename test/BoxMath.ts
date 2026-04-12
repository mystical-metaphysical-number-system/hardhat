import { expect } from "chai";
import { network } from "hardhat";
import { Monomial, MultiPoly } from "boxmath";

const { ethers } = await network.connect();

describe("BoxMath", function () {
  it("Should evaluate constant product xy correctly", async function () {
    const boxMath = await ethers.deployContract("BoxMath");
    const scale = 10n ** 18n;
    
    const x = 100n * scale;
    const y = 200n * scale;
    
    const solResult = await boxMath.constantProduct(x, y);
    
    const xy = new Monomial(scale, [1, 1]);
    const jsResult = xy.evaluate([x, y], 18);
    
    expect(solResult).to.equal(jsResult);
  });

  it("Should evaluate monomial xy with same result as JS", async function () {
    const boxMath = await ethers.deployContract("BoxMath");
    const scale = 10n ** 18n;
    
    const coefficient = scale;
    const exponents = [1, 1];
    const point = [10n * scale, 20n * scale];
    
    const solResult = await boxMath.evaluateMonomial(coefficient, exponents, point);
    
    const xy = new Monomial(coefficient, exponents);
    const jsResult = xy.evaluate(point, 18);
    
    expect(solResult).to.equal(jsResult);
  });

  it("Should match JS implementation for linear function", async function () {
    const boxMath = await ethers.deployContract("BoxMath");
    const scale = 10n ** 18n;
    
    const coefficient = 2n * scale;
    const exponents = [1, 0, 0];
    const point = [5n * scale, 0n, 0n];
    
    const solResult = await boxMath.evaluateMonomial(coefficient, exponents, point);
    
    const term = new Monomial(coefficient, exponents);
    const jsResult = term.evaluate(point, 18);
    
    expect(solResult).to.equal(jsResult);
  });
});
