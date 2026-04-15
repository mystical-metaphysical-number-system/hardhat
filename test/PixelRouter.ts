import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

/**
 * PixelRouter tests.
 *
 * Token layout:
 *   USDC → index 1
 *   ETH  → index 2
 *   BTC  → index 3
 *
 * Registered pools:
 *   [1,2]  USDC → ETH
 *   [2,3]  ETH  → BTC
 *   (no direct [1,3] USDC → BTC pool)
 *
 * Route pixels:
 *   hop1 = [1,2]  (USDC → ETH)
 *   hop2 = [2,3]  (ETH  → BTC)
 */
describe("PixelRouter", function () {
  async function setup() {
    const router = await ethers.deployContract("PixelRouter");

    // Use dummy addresses for tokens and pools
    const [, usdc, eth, btc, poolA, poolB] = await ethers.getSigners();

    await router.registerToken(usdc.address);  // index 1
    await router.registerToken(eth.address);   // index 2
    await router.registerToken(btc.address);   // index 3

    await router.registerPool(usdc.address, eth.address, poolA.address);  // [1,2]
    await router.registerPool(eth.address,  btc.address, poolB.address);  // [2,3]

    return { router, usdc, eth, btc, poolA, poolB };
  }

  it("registers tokens and assigns sequential indices", async function () {
    const { router, usdc, eth, btc } = await setup();
    expect(await router.tokenIndex(usdc.address)).to.equal(1n);
    expect(await router.tokenIndex(eth.address)).to.equal(2n);
    expect(await router.tokenIndex(btc.address)).to.equal(3n);
  });

  it("single hop [1,2]: USDC → ETH validates as [1,2]", async function () {
    const { router } = await setup();
    const route = await router.validateRoute([{ m: 1n, n: 2n }]);
    expect(route.m).to.equal(1n);
    expect(route.n).to.equal(2n);
  });

  it("2-hop [1,2]·[2,3] = [1,3]: USDC → ETH → BTC validates as [1,3]", async function () {
    const { router } = await setup();
    const route = await router.validateRoute([
      { m: 1n, n: 2n },  // USDC → ETH
      { m: 2n, n: 3n },  // ETH  → BTC
    ]);
    // pixelProduct chains: source=1 (USDC), dest=3 (BTC)
    expect(route.m).to.equal(1n);
    expect(route.n).to.equal(3n);
  });

  it("broken path [1,2]·[3,4] reverts: ETH ≠ BTC at join", async function () {
    const { router, usdc, eth, btc, poolA } = await setup();

    // Register a dummy extra token and pool so the hop itself exists
    const [,,,,, extra, poolC] = await ethers.getSigners();
    await router.registerToken(extra.address);  // index 4
    await router.registerPool(btc.address, extra.address, poolC.address);  // [3,4]

    // [1,2]·[3,4]: inner indices 2 ≠ 3 — broken path
    await expect(
      router.validateRoute([{ m: 1n, n: 2n }, { m: 3n, n: 4n }])
    ).to.be.revertedWith("broken path");
  });

  it("hop with no registered pool reverts", async function () {
    const { router } = await setup();
    // [1,3]: USDC → BTC direct — no pool registered
    await expect(
      router.validateRoute([{ m: 1n, n: 3n }])
    ).to.be.revertedWith("no pool for hop");
  });

  it("empty route reverts", async function () {
    const { router } = await setup();
    await expect(router.validateRoute([])).to.be.revertedWith("empty route");
  });
});
