# hardhat

Solidity contracts and Hardhat 3 test suite for the MMP on-chain math primitives. All contracts use exact `uint256` integer arithmetic — no fixed-point scaling, no `SCALE` constant, no division in core operations.

## Contracts

| Contract | Description |
|----------|-------------|
| `BoxMath.sol` | Polynomial algebra: `Polynumber`, `Multinumber`, evaluation, multiplication, truncation, caret product |
| `PixelMath.sol` | Ordered-pair algebra: `Pixel` (pixelProduct, transpose, Pythagorean triple), `Vexel` ops, `Maxel` ops |
| `PixelRouter.sol` | Multi-hop swap route validation via pixel algebra — structural path connectivity as a type |
| `MMPERC20.sol` | ERC20 with tax-aware transfer using BoxMath conservation invariant |
| `MMPPair.sol` | Uniswap V2-style AMM pool using `evaluatePolynumber` for the constant-product invariant |
| `SafePool.sol` | Demo: BoxMath-based AMM immune to rounding-based drain attacks |
| `VulnerablePool.sol` | Demo: `mulDown`-based AMM replicating the Balancer V2 rounding vulnerability |

## Tests

```bash
npx hardhat test           # all tests (mocha + solidity)
npx hardhat test mocha     # TypeScript integration tests only
npx hardhat test solidity  # Foundry-compatible Solidity unit tests
```

Current coverage:

| Suite | Tests |
|-------|-------|
| `BoxMath.ts` | Polynumber, Multinumber — evaluation, multiply, truncate, caretProduct |
| `PixelMath.ts` | Pixel product, transpose, Pythagorean triples; Vexel ops; Maxel product (paper Examples 22 & 23) |
| `PixelRouter.ts` | Single-hop, multi-hop, broken path, missing pool, empty route |
| `MMPERC20.ts` | Tax transfer, incommensurable split revert, decomposition mismatch revert |
| `MMPPair.ts` | Add liquidity, exact swap, conservative swap, overstated swap revert |
| `BalancerHack.ts` | `mulDown` rounding, k-collapse exploit, SafePool immunity |

## Key design notes

**No fixed-point arithmetic.** `BoxMath.sol` has no `SCALE`, `mulDown`, or division. All values passed in and returned are raw natural numbers matching the `bigint` TypeScript API exactly.

**ethers v6 struct caveat.** Functions that return `Polynumber` or `Multinumber` structs trigger a known ethers v6 bug with single-element `uint256[]` arrays inside nested structs. Use explicit ABI decoding via `AbiCoder.defaultAbiCoder()` with unnamed tuple types. See [Solidity API docs](https://mystical-metaphysical-number-system.github.io/mmp/docs/BoxMath/API/Solidity).

**Pixel struct re-use caveat.** When passing a `Pixel` returned by one contract call into a subsequent call, reconstruct a plain object first — ethers `Result` objects are read-only and cannot be used as struct inputs directly:

```ts
const [, rawPixel] = await pm.pixelProduct(a, b);
const pixel = { m: rawPixel.m, n: rawPixel.n };  // plain object
await pm.pixelProduct(pixel, c);
```

## Stack

- Hardhat 3 Beta
- Solidity 0.8.28
- ethers v6
- Mocha + Chai
- OpenZeppelin contracts (MockERC20 only)

## Docs

Full API reference: [mystical-metaphysical-number-system.github.io/mmp](https://mystical-metaphysical-number-system.github.io/mmp)
