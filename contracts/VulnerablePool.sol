// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Toy pool that reproduces the Balancer V2 upscaling vulnerability.
///
/// token0 is a 6-decimal token (USDC-like).
/// token1 is an 18-decimal token (wETH-like).
///
/// Before computing the invariant, token0 reserves are "upscaled" to 18
/// decimals via mulDown — exactly as in Balancer's _upscaleArray.
///
/// Root cause: mulDown(amount, 1e12) = (amount * 1e12) / 1e18 = amount / 1e6
/// When amount < 1e6, this rounds to 0.
/// k = upscale(reserve0) * reserve1 collapses to 0.
/// Any subsequent swap passes the invariant check (0 >= 0).
contract VulnerablePool {
    uint256 public constant SCALE          = 1e18;
    uint256 public constant SCALING_FACTOR = 1e12; // 6-dec → 18-dec

    IERC20 public immutable token0; // 6-decimal
    IERC20 public immutable token1; // 18-decimal

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public k;

    constructor(address t0, address t1) {
        token0 = IERC20(t0);
        token1 = IERC20(t1);
    }

    /// FixedPoint.mulDown: rounds DOWN on division
    function mulDown(uint256 a, uint256 b) public pure returns (uint256) {
        return (a * b) / SCALE;
    }

    /// Upscale a 6-decimal amount to 18-decimal space.
    /// mulDown(amount, 1e12) = amount / 1e6  (integer division — rounds down)
    /// For amount < 1e6: returns 0.
    function upscale(uint256 amount) public pure returns (uint256) {
        return mulDown(amount, SCALING_FACTOR);
    }

    function invariantOf(uint256 r0, uint256 r1) public pure returns (uint256) {
        return upscale(r0) * r1;
    }

    function addLiquidity(uint256 a0, uint256 a1) external {
        token0.transferFrom(msg.sender, address(this), a0);
        token1.transferFrom(msg.sender, address(this), a1);
        reserve0 += a0;
        reserve1 += a1;
        k = invariantOf(reserve0, reserve1);
    }

    /// Simulate BPT redemption driving reserve0 to the rounding boundary.
    /// In Balancer, large BPT redemptions reduce token balances without the
    /// constant-product check — this is the mechanism that pushes reserve0 into
    /// the < 1e6 zone where upscaling rounds to 0.
    function redeemBPT(uint256 newReserve0) external {
        uint256 delta = reserve0 - newReserve0;
        token0.transfer(msg.sender, delta);
        reserve0 = newReserve0;
        // k is recomputed from new (small) reserve0 — collapses to 0
        k = invariantOf(reserve0, reserve1);
    }

    /// Swap token0 in for token1 out.
    /// VULNERABLE: when k == 0, any swap passes the invariant check.
    function swap(uint256 amount0In, uint256 amount1Out) external {
        require(amount1Out < reserve1, "insufficient liquidity");
        token0.transferFrom(msg.sender, address(this), amount0In);
        token1.transfer(msg.sender, amount1Out);

        uint256 new0 = reserve0 + amount0In;
        uint256 new1 = reserve1 - amount1Out;

        // BUG: if k == 0, invariantOf(new0, new1) >= 0 always passes
        require(invariantOf(new0, new1) >= k, "invariant violated");

        reserve0 = new0;
        reserve1 = new1;
    }
}
