// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import '../libraries/SafeMath.sol';
contract BalanceWrapper {
    using SafeMath for uint256;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function _addStake(address user, uint256 amount) internal {
        _totalSupply = _totalSupply.add(amount);
        _balances[user] = _balances[user].add(amount);
    }

    function _removeStake(address user, uint256 amount) internal {
        _totalSupply = _totalSupply.sub(amount);
        _balances[user] = _balances[user].sub(amount);
    }
}
