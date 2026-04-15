// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./BoxMath.sol";

/// Token balances are variables in a linear MultiPoly over three participants:
/// accounts = x₀ + x₁ + x₂  (sender, recipient, treasury)
/// Every transfer must satisfy accounts.evaluate(before) == accounts.evaluate(after).
///
/// Proportional splits are checked as product identities — no division on-chain.
/// The caller proposes (amount, tax, received); the contract only asserts.
contract MMPERC20 {
    BoxMath private immutable _math;

    string public name;
    string public symbol;
    uint256 public totalSupply;

    address public immutable treasury;
    uint256 public immutable taxNumerator;
    uint256 public immutable taxDenominator;

    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 supply,
        address _treasury,
        uint256 _taxNumerator,
        uint256 _taxDenominator
    ) {
        _math        = new BoxMath();
        name         = _name;
        symbol       = _symbol;
        totalSupply  = supply;
        treasury     = _treasury;
        taxNumerator = _taxNumerator;
        taxDenominator = _taxDenominator;

        balanceOf[msg.sender] = supply;
    }

    /// Caller proposes (amount, tax, received).
    /// Contract asserts: proportion, decomposition, conservation.
    function transfer(
        address to,
        uint256 amount,
        uint256 tax,      // caller proposes — must satisfy taxDenominator * tax = taxNumerator * amount
        uint256 received  // caller proposes — must satisfy tax + received = amount
    ) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");

        // proportion: taxDenominator * tax = taxNumerator * amount  (no division)
        require(taxDenominator * tax == taxNumerator * amount, "incommensurable split");
        require(tax + received == amount, "decomposition mismatch");

        // conservation: encode the three accounts as a linear MultiPoly
        // x₀ + x₁ + x₂  —  evaluate before and after, assert equality
        uint256[] memory expSender    = new uint256[](3); expSender[0]    = 1;
        uint256[] memory expRecipient = new uint256[](3); expRecipient[1] = 1;
        uint256[] memory expTreasury  = new uint256[](3); expTreasury[2]  = 1;

        BoxMath.Monomial[] memory terms = new BoxMath.Monomial[](3);
        terms[0] = BoxMath.Monomial(1, expSender);
        terms[1] = BoxMath.Monomial(1, expRecipient);
        terms[2] = BoxMath.Monomial(1, expTreasury);

        BoxMath.MultiPoly memory accounts = BoxMath.MultiPoly(terms);

        uint256[] memory before = new uint256[](3);
        before[0] = balanceOf[msg.sender];
        before[1] = balanceOf[to];
        before[2] = balanceOf[treasury];

        uint256 S = _math.evaluateMultiPoly(accounts, before);

        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += received;
        balanceOf[treasury]   += tax;

        uint256[] memory next = new uint256[](3);
        next[0] = balanceOf[msg.sender];
        next[1] = balanceOf[to];
        next[2] = balanceOf[treasury];

        require(_math.evaluateMultiPoly(accounts, next) == S, "invariant violated");

        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
