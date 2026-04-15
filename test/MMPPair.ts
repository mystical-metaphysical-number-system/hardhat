import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("MMPPair — constant product (§7)", function () {
  async function deploy() {
    const [owner, trader] = await ethers.getSigners();

    const t0 = await ethers.deployContract("MockERC20", [10_000n]);
    const t1 = await ethers.deployContract("MockERC20", [10_000n]);

    const pair = await ethers.deployContract("MMPPair", [
      await t0.getAddress(),
      await t1.getAddress(),
    ]);
    const pairAddr = await pair.getAddress();

    // seed pool: reserve0=1000, reserve1=500  →  k=500000
    await t0.approve(pairAddr, 1000n);
    await t1.approve(pairAddr, 500n);
    await pair.addLiquidity(1000n, 500n);

    // give trader some t0
    await t0.mint(trader.address, 500n);

    return { pair, t0, t1, owner, trader, pairAddr };
  }

  it("seeds reserves correctly", async function () {
    const { pair } = await deploy();
    expect(await pair.reserve0()).to.equal(1000n);
    expect(await pair.reserve1()).to.equal(500n);
  });

  it("swap: exact division — 500000/1250 = 400", async function () {
    const { pair, t0, t1, trader, pairAddr } = await deploy();

    // newReserve0 = 1000 + 250 = 1250 → amountOut = 500 - 400 = 100
    // 1250 * 400 = 500000 = k  ✓
    await t0.connect(trader).approve(pairAddr, 250n);
    await pair.connect(trader).swapExactIn(250n, 100n);

    expect(await pair.reserve0()).to.equal(1250n);
    expect(await pair.reserve1()).to.equal(400n);
    expect(await t1.balanceOf(trader.address)).to.equal(100n);
  });

  it("swap: conservative amountOut — pool keeps surplus", async function () {
    const { pair, t0, t1, trader, pairAddr } = await deploy();

    // newReserve0 = 1100, exact amountOut = 500000/1100 ≈ 454.5
    // caller rounds down to 454 → 1100 * 46 = 50600 < 500000, but
    // caller proposes 455 → 1100 * 45 = 49500 < 500000 still fails
    // correct: reserve1 - amountOut = 500 - 454 = 46  → 1100*46=50600 < k, revert
    // caller must propose 455: reserve1 - 455 = 45  → 1100*45=49500 still < k
    // actually: amountOut=45 → reserve1=455 → 1100*455=500500 >= 500000 ✓
    await t0.connect(trader).approve(pairAddr, 100n);
    await pair.connect(trader).swapExactIn(100n, 45n);  // undershoots — pool keeps surplus

    expect(await pair.reserve0()).to.equal(1100n);
    expect(await pair.reserve1()).to.equal(455n);  // 1100*455=500500 ≥ 500000 ✓
  });

  it("swap: overstated amountOut reverts", async function () {
    const { pair, t0, trader, pairAddr } = await deploy();

    // amountOut=456 → 1100*(500-456)=1100*44=48400 < 500000 → invariant violated
    await t0.connect(trader).approve(pairAddr, 100n);
    await expect(
      pair.connect(trader).swapExactIn(100n, 456n)
    ).to.be.revertedWith("invariant violated");
  });

  it("swap: zero input reverts", async function () {
    const { pair, trader } = await deploy();
    await expect(
      pair.connect(trader).swapExactIn(0n, 10n)
    ).to.be.revertedWith("zero input");
  });
});
