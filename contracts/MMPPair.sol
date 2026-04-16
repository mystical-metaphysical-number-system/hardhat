// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./BoxMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Constant product AMM — §7 of the Encoding series.
///
/// Invariant: x · y = k  encoded as BoxMath.Polynumber(1, [1,1])
///
/// swap: caller proposes amountOut; pool asserts invariant holds.
/// No division on-chain. Surplus (rounding in caller's favour for the pool)
/// accumulates as fees — pool can only grow.
contract MMPPair {
    BoxMath private immutable _math;

    IERC20 public token0;
    IERC20 public token1;

    uint256 public reserve0;
    uint256 public reserve1;

    event Swap(address indexed sender, uint256 amountIn, uint256 amountOut);
    event Sync(uint256 reserve0, uint256 reserve1);

    constructor(address _token0, address _token1) {
        _math  = new BoxMath();
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    /// Seed initial reserves. Caller must have approved both amounts.
    function addLiquidity(uint256 amount0, uint256 amount1) external {
        token0.transferFrom(msg.sender, address(this), amount0);
        token1.transferFrom(msg.sender, address(this), amount1);
        reserve0 += amount0;
        reserve1 += amount1;
        emit Sync(reserve0, reserve1);
    }

    /// Swap exact token0 in for token1 out.
    /// Caller proposes amountOut — must satisfy xy(new reserves) >= k.
    function swapExactIn(uint256 amountIn, uint256 amountOut) external {
        require(amountIn  > 0, "zero input");
        require(amountOut > 0, "zero output");
        require(amountOut < reserve1, "insufficient liquidity");

        // invariant: k = reserve0 * reserve1
        uint256[] memory exps = new uint256[](2);
        exps[0] = 1; exps[1] = 1;
        BoxMath.Polynumber memory xy = BoxMath.Polynumber(1, exps);

        uint256[] memory point = new uint256[](2);
        point[0] = reserve0;
        point[1] = reserve1;
        uint256 k = _math.evaluatePolynumber(xy, point);

        token0.transferFrom(msg.sender, address(this), amountIn);
        token1.transfer(msg.sender, amountOut);

        uint256[] memory newPoint = new uint256[](2);
        newPoint[0] = reserve0 + amountIn;
        newPoint[1] = reserve1 - amountOut;

        // caller-proposes: pool only checks, never divides
        require(_math.evaluatePolynumber(xy, newPoint) >= k, "invariant violated");

        reserve0 = newPoint[0];
        reserve1 = newPoint[1];

        emit Swap(msg.sender, amountIn, amountOut);
        emit Sync(reserve0, reserve1);
    }
}
