// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BoxMath.sol";

/// Isolated demo contract for the Balancer V2 case study (§9).
///
/// Constant product invariant computed via BoxMath.evaluateMonomial — two
/// multiplications, no division, no upscaling step.
///
/// token0 and token1 are stored at their native scale.
/// k = reserve0 * reserve1 (exact natural number).
/// A reserve of 9 raw units contributes 9 to the product — never 0.
contract SafePool {
    BoxMath private immutable _math;

    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public k;

    constructor(address t0, address t1) {
        _math  = new BoxMath();
        token0 = IERC20(t0);
        token1 = IERC20(t1);
    }

    function _invariant(uint256 r0, uint256 r1) internal view returns (uint256) {
        uint256[] memory exps = new uint256[](2);
        exps[0] = 1; exps[1] = 1;
        uint256[] memory point = new uint256[](2);
        point[0] = r0; point[1] = r1;
        return _math.evaluateMonomial(BoxMath.Monomial(1, exps), point);
    }

    function addLiquidity(uint256 a0, uint256 a1) external {
        token0.transferFrom(msg.sender, address(this), a0);
        token1.transferFrom(msg.sender, address(this), a1);
        reserve0 += a0;
        reserve1 += a1;
        k = _invariant(reserve0, reserve1);
    }

    /// Swap token0 in for token1 out.
    /// Caller proposes amountOut; pool asserts k holds — no division.
    function swap(uint256 amount0In, uint256 amount1Out) external {
        require(amount0In  > 0,         "zero input");
        require(amount1Out < reserve1,  "insufficient liquidity");

        token0.transferFrom(msg.sender, address(this), amount0In);
        token1.transfer(msg.sender, amount1Out);

        uint256 new0 = reserve0 + amount0In;
        uint256 new1 = reserve1 - amount1Out;

        require(_invariant(new0, new1) >= k, "invariant violated");

        reserve0 = new0;
        reserve1 = new1;
    }
}
