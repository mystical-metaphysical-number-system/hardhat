import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();
const { parseEther } = ethers;

describe("BoxMath", function () {
  it("constantProduct: (x * y) / SCALE", async function () {
    const boxMath = await ethers.deployContract("BoxMath");
    const x = parseEther("100");
    const y = parseEther("200");
    const result = await boxMath.constantProduct(x, y);
    expect(result).to.equal(parseEther("20000"));
  });

  it("evaluateMonomial: coefficient * x^e0 * y^e1 in fixed-point", async function () {
    const boxMath = await ethers.deployContract("BoxMath");
    const result = await boxMath.evaluateMonomial(
      parseEther("1"),
      [1, 1],
      [parseEther("10"), parseEther("20")]
    );
    expect(result).to.equal(parseEther("200"));
  });

  it("evaluateMonomial: linear term 2x at x=5", async function () {
    const boxMath = await ethers.deployContract("BoxMath");
    const result = await boxMath.evaluateMonomial(
      parseEther("2"),
      [1, 0, 0],
      [parseEther("5"), 0n, 0n]
    );
    expect(result).to.equal(parseEther("10"));
  });
});
