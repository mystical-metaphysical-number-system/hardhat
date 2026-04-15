// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/**
 * PixelMath — Solidity implementation of Pixels and Vexels from Box Arithmetic.
 *
 * Pixel: a 2-listbox of natural numbers [m, n].
 *   Product: [m,n]·[p,q] = [m,q] when n = p, otherwise nothing.
 *   Transpose: [m,n]^T = [n,m]
 *
 * Pythagorean parametrization (m > n > 0):
 *   pixel [m, n]  →  (m²-n², 2mn, m²+n²)
 *
 * Vexel: a coefficient vector over singleton indices.
 *   Represented as a dense uint256[] of coefficients.
 */
contract PixelMath {
    struct Pixel {
        uint256 m;
        uint256 n;
    }

    // Pixel product returns a success flag since Solidity has no null.
    // ok = false means the product is "nothing" (n != p).
    function pixelProduct(Pixel memory a, Pixel memory b)
        public
        pure
        returns (bool ok, Pixel memory result)
    {
        if (a.n != b.m) return (false, Pixel(0, 0));
        return (true, Pixel(a.m, b.n));
    }

    function pixelTranspose(Pixel memory p) public pure returns (Pixel memory) {
        return Pixel(p.n, p.m);
    }

    function pixelIsDiagonal(Pixel memory p) public pure returns (bool) {
        return p.m == p.n;
    }

    /**
     * Pythagorean triple from pixel [m, n] where m > n > 0.
     * Returns (ok, a, b, c) where a² + b² = c².
     */
    function pythagoreanTriple(Pixel memory p)
        public
        pure
        returns (bool ok, uint256 a, uint256 b, uint256 c)
    {
        if (p.m <= p.n || p.n == 0) return (false, 0, 0, 0);
        a = p.m * p.m - p.n * p.n;
        b = 2 * p.m * p.n;
        c = p.m * p.m + p.n * p.n;
        return (true, a, b, c);
    }

    // -------------------------------------------------------------------------
    // Maxel — sparse box of pixels with natural-number coefficients
    // -------------------------------------------------------------------------

    struct MaxelEntry {
        Pixel pixel;
        uint256 coeff;
    }

    function maxelTranspose(MaxelEntry[] memory M)
        public
        pure
        returns (MaxelEntry[] memory result)
    {
        result = new MaxelEntry[](M.length);
        for (uint256 i = 0; i < M.length; i++) {
            result[i] = MaxelEntry(pixelTranspose(M[i].pixel), M[i].coeff);
        }
    }

    /**
     * Maxel product: MN = { pq : p ∈ M, q ∈ N }, dropping nothing products.
     * Coefficients of identical result pixels are summed.
     * Returns a sparse list — caller should expect duplicate pixels merged.
     */
    function maxelProduct(MaxelEntry[] memory M, MaxelEntry[] memory N)
        public
        pure
        returns (MaxelEntry[] memory result)
    {
        // First pass: collect all non-nothing products (may have duplicates)
        uint256 maxLen = M.length * N.length;
        MaxelEntry[] memory raw = new MaxelEntry[](maxLen);
        uint256 count = 0;

        for (uint256 i = 0; i < M.length; i++) {
            for (uint256 j = 0; j < N.length; j++) {
                (bool ok, Pixel memory p) = pixelProduct(M[i].pixel, N[j].pixel);
                if (ok) {
                    raw[count++] = MaxelEntry(p, M[i].coeff * N[j].coeff);
                }
            }
        }

        // Second pass: merge duplicate pixels by summing coefficients
        bool[] memory merged = new bool[](count);
        uint256 unique = 0;

        for (uint256 i = 0; i < count; i++) {
            if (merged[i]) continue;
            uint256 total = raw[i].coeff;
            for (uint256 j = i + 1; j < count; j++) {
                if (!merged[j] &&
                    raw[j].pixel.m == raw[i].pixel.m &&
                    raw[j].pixel.n == raw[i].pixel.n)
                {
                    total += raw[j].coeff;
                    merged[j] = true;
                }
            }
            raw[i].coeff = total;
            unique++;
        }

        result = new MaxelEntry[](unique);
        uint256 idx = 0;
        for (uint256 i = 0; i < count; i++) {
            if (!merged[i]) result[idx++] = raw[i];
        }
    }

    // -------------------------------------------------------------------------
    // Vexel — dense coefficient vector (index i → coeffs[i])
    // -------------------------------------------------------------------------

    function vexelAdd(uint256[] memory u, uint256[] memory v)
        public
        pure
        returns (uint256[] memory result)
    {
        uint256 len = u.length > v.length ? u.length : v.length;
        result = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 a = i < u.length ? u[i] : 0;
            uint256 b = i < v.length ? v[i] : 0;
            result[i] = a + b;
        }
    }

    function vexelScale(uint256[] memory u, uint256 scalar)
        public
        pure
        returns (uint256[] memory result)
    {
        result = new uint256[](u.length);
        for (uint256 i = 0; i < u.length; i++) {
            result[i] = u[i] * scalar;
        }
    }

    function vexelDot(uint256[] memory u, uint256[] memory v)
        public
        pure
        returns (uint256 sum)
    {
        uint256 len = u.length < v.length ? u.length : v.length;
        for (uint256 i = 0; i < len; i++) {
            sum += u[i] * v[i];
        }
    }
}
