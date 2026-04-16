// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract BoxMath {
    struct Polynumber {
        uint256 coefficient;
        uint256[] exponents;
    }

    struct Multinumber {
        Polynumber[] terms;
    }

    function pow(uint256 base, uint256 exp) public pure returns (uint256) {
        if (exp == 0) return 1;
        if (exp == 1) return base;
        uint256 result = 1;
        for (uint256 i = 0; i < exp; i++) {
            result = result * base;
        }
        return result;
    }

    function caretProduct(uint256[][] memory boxes) public pure returns (uint256[] memory) {
        uint256[] memory acc = new uint256[](1);
        acc[0] = 1;
        for (uint256 b = 0; b < boxes.length; b++) {
            uint256[] memory box = boxes[b];
            uint256[] memory next = new uint256[](acc.length * box.length);
            for (uint256 i = 0; i < acc.length; i++) {
                for (uint256 j = 0; j < box.length; j++) {
                    next[i * box.length + j] = acc[i] * box[j];
                }
            }
            acc = next;
        }
        return acc;
    }

    function polynumberDegree(Polynumber memory m) public pure returns (uint256) {
        uint256 deg = 0;
        for (uint256 i = 0; i < m.exponents.length; i++) {
            deg += m.exponents[i];
        }
        return deg;
    }

    function evaluatePolynumber(Polynumber memory m, uint256[] memory point) public pure returns (uint256) {
        uint256 result = m.coefficient;
        for (uint256 i = 0; i < m.exponents.length; i++) {
            if (m.exponents[i] > 0) {
                uint256 base = i < point.length ? point[i] : 0;
                result = result * pow(base, m.exponents[i]);
            }
        }
        return result;
    }

    function multiplyPolynumbers(Polynumber memory a, Polynumber memory b) public pure returns (Polynumber memory) {
        uint256 newCoeff = a.coefficient * b.coefficient;
        uint256 maxLen = a.exponents.length > b.exponents.length ? a.exponents.length : b.exponents.length;
        uint256[] memory newExps = new uint256[](maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            uint256 e1 = i < a.exponents.length ? a.exponents[i] : 0;
            uint256 e2 = i < b.exponents.length ? b.exponents[i] : 0;
            newExps[i] = e1 + e2;
        }
        return Polynumber(newCoeff, newExps);
    }

    function evaluateMultinumber(Multinumber memory p, uint256[] memory point) public pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < p.terms.length; i++) {
            sum += evaluatePolynumber(p.terms[i], point);
        }
        return sum;
    }

    function addMultinumber(Multinumber memory a, Multinumber memory b) public pure returns (Multinumber memory) {
        Polynumber[] memory newTerms = new Polynumber[](a.terms.length + b.terms.length);
        for (uint256 i = 0; i < a.terms.length; i++) newTerms[i] = a.terms[i];
        for (uint256 i = 0; i < b.terms.length; i++) newTerms[a.terms.length + i] = b.terms[i];
        return Multinumber(newTerms);
    }

    function multiplyMultinumber(Multinumber memory a, Multinumber memory b) public pure returns (Multinumber memory) {
        Polynumber[] memory newTerms = new Polynumber[](a.terms.length * b.terms.length);
        uint256 idx = 0;
        for (uint256 i = 0; i < a.terms.length; i++) {
            for (uint256 j = 0; j < b.terms.length; j++) {
                newTerms[idx++] = multiplyPolynumbers(a.terms[i], b.terms[j]);
            }
        }
        return Multinumber(newTerms);
    }

    function truncate(Multinumber memory p, uint256 k) public pure returns (Multinumber memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < p.terms.length; i++) {
            if (polynumberDegree(p.terms[i]) <= k) count++;
        }
        Polynumber[] memory filtered = new Polynumber[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < p.terms.length; i++) {
            if (polynumberDegree(p.terms[i]) <= k) filtered[idx++] = p.terms[i];
        }
        return Multinumber(filtered);
    }
}
