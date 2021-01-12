// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import '../general/BalanceExpireTracker.sol';

contract BalanceExpireTrackerMock is BalanceExpireTracker {

    uint160 public lastId;

    function isSomethingExpired() external view returns(bool) {
        return expired();
    }

    function add(uint64 expiresAt) external {
        uint160 id = ++lastId;
        push(id, expiresAt);
    }

    function remove(uint160 id) external {
        pop(id);
    }

    function forceAdd(uint160 id, uint64 expiresAt) external {
        push(id, expiresAt);
    }
}
