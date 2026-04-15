import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("MMPERC20", function () {
  async function deploy() {
    const [owner, alice, bob, treasury] = await ethers.getSigners();
    const token = await ethers.deployContract("MMPERC20", [
      "MMP Token", "MMP",
      1000n,          // supply
      treasury.address,
      1n,             // taxNumerator:   1-in-10
      10n,            // taxDenominator
    ]);
    return { token, owner, alice, bob, treasury };
  }

  it("mints total supply to deployer", async function () {
    const { token, owner } = await deploy();
    expect(await token.balanceOf(owner.address)).to.equal(1000n);
  });

  it("transfer: exact split satisfies proportion and conservation", async function () {
    const { token, owner, alice, treasury } = await deploy();
    // amount = 100, tax = 10, received = 90
    await token.transfer(alice.address, 100n, 10n, 90n);

    expect(await token.balanceOf(owner.address)).to.equal(900n);
    expect(await token.balanceOf(alice.address)).to.equal(90n);
    expect(await token.balanceOf(treasury.address)).to.equal(10n);
  });

  it("transfer: incommensurable amount reverts", async function () {
    const { token, alice } = await deploy();
    // amount = 99 — no valid (tax, received) exists for a 1-in-10 rate
    await expect(
      token.transfer(alice.address, 99n, 9n, 90n)
    ).to.be.revertedWith("incommensurable split");
  });

  it("transfer: decomposition mismatch reverts", async function () {
    const { token, alice } = await deploy();
    // proportion is satisfied but tax + received ≠ amount
    await expect(
      token.transfer(alice.address, 100n, 10n, 80n)
    ).to.be.revertedWith("decomposition mismatch");
  });

  it("transfer: insufficient balance reverts", async function () {
    const { token, alice, bob } = await deploy();
    // bob has no balance
    await expect(
      token.connect(bob).transfer(alice.address, 100n, 10n, 90n)
    ).to.be.revertedWith("insufficient balance");
  });
});
