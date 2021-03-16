// SPDX-License-Identifier: MIT

pragma solidity ^0.6.6;

import '../general/ExpireTracker.sol';
contract ExpireTrackerMock is ExpireTracker {

    uint96 public lastId;

    uint256 public count;

    function isSomethingExpired() external view returns(bool) {
        return expired();
    }

    function removeAllExpired() external {
        while(expired()){
            pop(head);
        }
    }

    function add(uint64 expiresAt) external {
        uint96 id = ++lastId;
        push(id, expiresAt);
        count++;
    }

    function remove(uint96 id) external {
        pop(id);
        count--;
    }

    function forceAdd(uint96 id, uint64 expiresAt) external {
        push(id, expiresAt);
        count++;
    }
}
