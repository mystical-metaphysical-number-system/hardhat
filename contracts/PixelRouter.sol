// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./PixelMath.sol";

/**
 * PixelRouter — multi-hop swap route validation using pixel algebra.
 *
 * Each token is assigned a natural-number index. A pool hop from token m to
 * token n is a pixel [m, n]. A multi-hop route is a sequence of such pixels.
 *
 * Route validity is entirely expressed through pixelProduct:
 *
 *   [A,B] · [B,C] = [A,C]   → valid 2-hop, source A, dest C
 *   [A,B] · [C,D] = nothing  → broken path (B ≠ C), revert
 *
 * The final pixel [source, dest] is the compact summary of the whole route.
 * Associativity means partial routes can be pre-composed and cached.
 *
 * Compare this to Uniswap V3's abi.encodePacked path encoding, where validity
 * is checked implicitly by the router via explicit token equality assertions at
 * each hop. Here the "nothing" semantic does the rejection automatically — a
 * broken path has no valid pixel representation.
 */
contract PixelRouter is PixelMath {
    // token address → natural number index (0 = unregistered)
    mapping(address => uint256) public tokenIndex;
    uint256 public tokenCount;

    // pixel key [from, to] → pool address (address(0) = no pool)
    mapping(uint256 => mapping(uint256 => address)) public pool;

    event TokenRegistered(address indexed token, uint256 idx);
    event PoolRegistered(uint256 from, uint256 to, address pool);

    function registerToken(address token) external returns (uint256 idx) {
        require(tokenIndex[token] == 0, "already registered");
        idx = ++tokenCount;
        tokenIndex[token] = idx;
        emit TokenRegistered(token, idx);
    }

    function registerPool(address tokenIn, address tokenOut, address poolAddr) external {
        uint256 from = tokenIndex[tokenIn];
        uint256 to   = tokenIndex[tokenOut];
        require(from != 0 && to != 0, "unregistered token");
        require(poolAddr != address(0), "zero pool");
        pool[from][to] = poolAddr;
        emit PoolRegistered(from, to, poolAddr);
    }

    /**
     * Validate a multi-hop route expressed as an ordered list of pixels.
     *
     * Each hop pixel [from, to] must:
     *   1. Have a registered pool (liquidity exists)
     *   2. Chain with the previous hop via pixelProduct (path is connected)
     *
     * Returns the summarising pixel [source, dest] of the full route.
     * Reverts on broken path or missing pool.
     */
    function validateRoute(Pixel[] memory hops)
        public
        view
        returns (Pixel memory route)
    {
        require(hops.length >= 1, "empty route");

        for (uint256 i = 0; i < hops.length; i++) {
            require(pool[hops[i].m][hops[i].n] != address(0), "no pool for hop");
        }

        route = hops[0];
        for (uint256 i = 1; i < hops.length; i++) {
            (bool ok, Pixel memory next) = pixelProduct(route, hops[i]);
            require(ok, "broken path");
            route = next;
        }
    }
}
