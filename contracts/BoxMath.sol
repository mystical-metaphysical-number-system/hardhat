// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract BoxMath {
  uint256 public constant PRECISION = 18;
  uint256 public constant SCALE = 10**PRECISION;

  function pow(uint256 base, uint256 exp) public pure returns (uint256) {
    if (exp == 0) return SCALE;
    if (exp == 1) return base;
    
    uint256 result = SCALE;
    for (uint256 i = 0; i < exp; i++) {
      result = (result * base) / SCALE;
    }
    return result;
  }

  function evaluateMonomial(
    uint256 coefficient,
    uint256[] memory exponents,
    uint256[] memory point
  ) public pure returns (uint256) {
    uint256 result = coefficient;
    
    for (uint256 i = 0; i < exponents.length; i++) {
      if (exponents[i] > 0) {
        uint256 base = i < point.length ? point[i] : 0;
        uint256 varPower = pow(base, exponents[i]);
        result = (result * varPower) / SCALE;
      }
    }
    
    return result;
  }

  function constantProduct(uint256 x, uint256 y) public pure returns (uint256) {
    return (x * y) / SCALE;
  }
}
